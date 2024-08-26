var ChromePhpLogger = function()
{
    var cookie_name = "chromephp_log";
    var local_storage = null;
    var request_times = [];

    var _getChromeVersion = function()
    {
        /Chrome\/(.*)\s/.test(navigator.userAgent);
        return RegExp.$1.split(".")[0];
    };

    var _useCookieApi = function()
    {
        return _getChromeVersion() >= 6;
    };

    var _cleanUpCookie = function(cookie)
    {
        cookie = decodeURIComponent(cookie);
        if (Util.strpos(cookie, "\"version") !== false) {
            return cookie;
        }
        return Base64.decode(cookie);
    };

    var _convertToJson = function(cookie)
    {
        data = JSON.parse(cookie);
        if (typeof data === "string") {
            data = JSON.parse(data);
        }
        return data;
    };

    var _logDataFromUrl = function(url)
    {
        var request = new XMLHttpRequest();
        request.open("GET", url + "?time=" + new Date().getTime());
        request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

        request.onreadystatechange = function(e) {
            if (request.readyState == 4) {
                switch (request.status) {
                    case 200:
                        response = request.responseText;
                        if (data.version < "0.1475") {
                            response = decodeURIComponent(response);
                        }
                        data = JSON.parse(response);
                        return _logData(data);
                    case 404:
                        console.warn('404 Page Not Found', url);
                        break;
                    case 403:
                        console.warn('403 Forbidden', url);
                        break;
                }
            }
        };
        return request.send();
    };

    var _lookForCookie = function()
    {
        if (!_useCookieApi()) {
            cookie = Util.getCookie(cookie_name);
            return _handleCookie(cookie);
        }

        request = {
            name : "cookie",
            url : document.location.href,
            cookie_name : cookie_name
        };

        chrome.extension.sendRequest(request, function(cookie) {
            if (cookie === null) {
                return _handleCookie(null);
            }
            return _handleCookie(cookie.value);
        });
    };

    var _showLineNumbers = function()
    {
        return local_storage.show_line_numbers == "true";
    };

    var _showUpgradeMessages = function()
    {
        if (local_storage.show_upgrade_messages === undefined) {
            return true;
        }
        return local_storage.show_upgrade_messages == "true";
    };

    var _logCleanData = function(data, callback)
    {
        column_map = {};
        for (key in data.columns) {
            column_name = data.columns[key];
            column_map[column_name] = key;
        }

        var rows = data.rows;
        for (i = 0; i < rows.length; ++i) {
            row = rows[i];
            backtrace = row[column_map.backtrace];
            label = row[column_map.label];
            log = row[column_map.log];
            type = row[column_map.type];

            if (_showLineNumbers() && backtrace !== null) {
                console.log(backtrace);
            }

            var show_label = label && typeof label === "string";

            switch (type) {
                case 'group':
                    console.group(log);
                    break;
                case 'groupEnd':
                    console.groupEnd(log);
                    break;
                case 'groupCollapsed':
                    console.groupCollapsed(log);
                    break;
                case 'warn':
                    if (show_label) {
                        console.warn(label, log);
                        break;
                    }
                    console.warn(log);
                    break;
                case 'error':
                    if (show_label) {
                        console.error(label, log);
                        break;
                    }
                    console.error(log);
                    break;
                default:
                    if (show_label) {
                        console.log(label, log);
                        break;
                    }
                    console.log(log);
                    break;
            }
        }
        callback();
    };

    var _logDirtyData = function(data, callback)
    {
        values = data["data"];
        backtrace_values = data["backtrace"];
        label_values = data["labels"];

        var last_backtrace = null;
        if (values.length) {
            for (i = 0; i < values.length; ++i) {
                if (_showLineNumbers() && backtrace_values[i] !== null && last_backtrace != backtrace_values[i]) {
                    last_backtrace = backtrace_values[i];
                    console.log(backtrace_values[i]);
                }
                if (label_values[i] && typeof label_values[i] === "string") {
                    console.log(label_values[i], values[i]);
                } else {
                    console.log(values[i]);
                }
            }
        }
        callback();
    };

    var _logData = function(data)
    {
        if (_showUpgradeMessages() && data.version < "2.2.1") {
            console.warn("you are using version " + data.version + " of the ChromePHP Server Side Library.\nThe latest version is 2.2.1.\nIt is recommended that you upgrade at http://www.chromephp.com");
        }
        if (data.version > "0.147") {
            return _logCleanData(data, _complete);
        }
        return _logDirtyData(data, _complete);
    };

    var _complete = function()
    {
        if (!_useCookieApi()) {
            Util.eatCookie(cookie_name);
            return;
        }

        request = {
            name : "eatCookie",
            url : document.location.href,
            cookie_name : cookie_name
        };

        chrome.extension.sendRequest(request);
    };

    var _handleCookie = function(cookie)
    {
        if (cookie === null) {
            return;
        }

        data = _cleanUpCookie(cookie);
        data = _convertToJson(data);

        if (data.uri) {
            if (Util.inArray(data.time, request_times)) {
                return;
            }
            request_times.push(data.time);
            return _logDataFromUrl(data.uri);
        }

        return _logData(data);
    };

    var _listenForCookies = function()
    {
        chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
            if (request.name != "cookie_update") {
                return;
            }

            if (request.info.removed) {
                return sendResponse("done");
            }

            if (request.info.cookie.name != cookie_name) {
                return sendResponse("done");
            }

            _handleCookie(request.info.cookie.value);
            sendResponse("done");
        });
    }

    return {
        run : function()
        {
            return _lookForCookie();
        },

        initStorage : function()
        {
            chrome.extension.sendRequest("localStorage", function(response) {
                local_storage = response;
                if (_useCookieApi()) {
                    _listenForCookies();
                }
                ChromePhpLogger.run();
            });
        },

        init : function()
        {
            chrome.extension.sendRequest("isActive", function(response) {
                if (response === false) {
                    return;
                }
                return ChromePhpLogger.initStorage();
            });
        }
    };
} ();

var Util = {
    trim : function(text)
    {
        return (text || "").replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, "");
    },

    strpos : function(haystack, needle, offset)
    {
        var i = (haystack+'').indexOf(needle, (offset || 0));
        return i === -1 ? false : i;
    },

    getCookie : function(name)
    {
        var cookie_value = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = this.trim(cookies[i]);
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookie_value = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookie_value;
    },

    eatCookie : function(name)
    {
        document.cookie = name + '=; expires=Thu, 01-Jan-70 00:00:01 GMT;';
    },

    inArray : function(needle, haystack)
    {
        for (key in haystack) {
            if (haystack[key] == needle) {
                return true;
            }
        }
        return false;
    }
};

ChromePhpLogger.init();

var Base64 = {
    _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    encode : function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        input = Base64._utf8_encode(input);

        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output +
            this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
            this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
        }
        return output;
    },

    decode : function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {
            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        output = Base64._utf8_decode(output);
        return output;
    },

    _utf8_encode : function (string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    },

    _utf8_decode : function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;

        while (i < utftext.length) {
            c = utftext.charCodeAt(i);
            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            } else if ((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            } else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    }
};
