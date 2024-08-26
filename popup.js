import { formatDate, formatDateTime } from './utils.js';
import { openDB, addLogItemToDB, getLogItemsFromDB, deleteLogItemFromDB } from './db.js';

document.addEventListener("DOMContentLoaded", async () => {
    const logContainer = document.getElementById("__log_list_container");
    const noLogItem = document.getElementById("__no_log_item");
    const input = document.getElementById("__log_input");
    const submitButton = document.getElementById("__log_save_button");
    const dateView = document.getElementById("__date");
    const prevButton = document.getElementById("__date_prev");
    const nextButton = document.getElementById("__date_next");
    const datepicker = document.getElementById("__datepicker");

    let logData = [];
    let date = new Date();

    await openDB();

    const addEventListeners = () => {
        submitButton.addEventListener("click", submitButtonClickHandler);
        prevButton.addEventListener("click", () => updateCalendarAndFetchData(-1));
        nextButton.addEventListener("click", () => updateCalendarAndFetchData(1));
        dateView.addEventListener("click", () => {
            if ("showPicker" in HTMLInputElement.prototype) {
                datepicker.showPicker()
            }

        });
        datepicker.addEventListener("change", (event) => {
            const selectedDate = new Date(event.target.value);
            if (!isNaN(selectedDate.getTime())) {
                date = selectedDate;
                initCalendar();
                fetchDailyLogData();
                checkShowNextButton();
            }
        });
    };
    
    
    input.addEventListener("keyup", function (event) {
        if (event.keyCode === 13) {
            const inputValue = input.value.trim();
            if (inputValue) {
                addDailyLogItem()
            }
        }
    });

    const migrateData = async () => {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(null, async (items) => {
                const keys = Object.keys(items);
                if (keys.length === 0) {
                    resolve();
                    return;
                }

                for (const key of keys) {
                    const logs = JSON.parse(items[key]);
                    for (const log of logs) {
                        await addLogItemToDB(key, log);
                    }
                }

                chrome.storage.sync.clear(() => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
        });
    };
    const addDailyLogItem = async () => {
        const inputValue = input.value.trim();
        if (inputValue) {
            const newLog = { log: inputValue, dateTime: date.getTime() };
            logData.push(newLog);
            await addLogItemToDB(getDateLookup(), newLog);
            input.value = "";
            renderLogData();
        }
    };

    const submitButtonClickHandler = async () => {
        await addDailyLogItem();
    };

    const renderLogData = () => {
        if (logData.length === 0) {
            logContainer.style.display = "none";
            noLogItem.style.display = "flex";
        } else {
            logContainer.innerHTML = logData.map(item => `
                <div class="log-item">
                    <div class="log-date">${formatDateTime(item.dateTime)}</div>
                    <div class="log-text">${item.log}</div>
                    <div class="log-actions">
                        <button class="log-action-delete" data-time="${item.dateTime}">Delete</button>
                    </div>
                </div>
            `).join("");
            logContainer.style.display = "flex";
            noLogItem.style.display = "none";
            document.querySelectorAll(".log-action-delete").forEach(button => {
                button.addEventListener("click", async (event) => {
                    await deleteLogItem(event);
                });
            });
        }
    };

    const deleteLogItem = async (event) => {
        const dateTime = parseInt(event.target.getAttribute("data-time"), 10);
        logData = logData.filter(item => item.dateTime !== dateTime);
        await deleteLogItemFromDB(getDateLookup(), dateTime);
        renderLogData();
    };

    const fetchDailyLogData = async () => {
        logData = await getLogItemsFromDB(getDateLookup());
        renderLogData();
    };

    const getDateLookup = () => `${date.getUTCDate()}${date.getUTCMonth()}${date.getUTCFullYear()}`;

    const initCalendar = () => {
        dateView.textContent = formatDate(date);
        const input_date = date.toLocaleDateString('en-CA');
        datepicker.value = input_date
    };

    const updateCalendarAndFetchData = async (increment) => {
        date.setDate(date.getDate() + increment);
        initCalendar();
        await fetchDailyLogData();
        checkShowNextButton();
    };

    const checkShowNextButton = () => {
        
    };

    const migrationFlag = await chrome.storage.local.get('migrationCompleted');
    if (!migrationFlag.migrationCompleted) {
        await migrateData();
        await chrome.storage.local.set({ 'migrationCompleted': true });
    }
    await fetchDailyLogData();
    addEventListeners();
    initCalendar();
    checkShowNextButton();
});
