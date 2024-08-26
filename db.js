const dbName = "log-extension";
const storeName = "logs";

export const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = (event) => {
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "dateLookup" });
            }
        };
    });
};

export const addLogItemToDB = async (dateLookup, logItem) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const getRequest = store.get(dateLookup);

        getRequest.onsuccess = () => {
            const data = getRequest.result || { dateLookup, logs: [] };
            data.logs.push(logItem);
            const putRequest = store.put(data);

            putRequest.onsuccess = () => resolve();
            putRequest.onerror = (event) => reject(event.target.error);
        };

        getRequest.onerror = (event) => {
            reject(event.target.error)
        };
    });
};

export const getLogItemsFromDB = async (dateLookup) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(dateLookup)
        request.onsuccess = (event) => {
            const entry = request.result;
            if (entry && entry.logs) {
                resolve(entry.logs);
            } else {
                console.log("No logs")
                resolve([]);
            }
        };


        request.onerror = (event) => {
            console.error("Error fetching logs:", event.target.error);
            reject(event.target.error);
        };
    });
};

       


export const deleteLogItemFromDB = async (dateLookup, dateTime) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const getRequest = store.get(dateLookup);

        getRequest.onsuccess = () => {
            const data = getRequest.result;
            if (data) {
                data.logs = data.logs.filter(log => log.dateTime !== dateTime);
                const putRequest = store.put(data);

                putRequest.onsuccess = () => resolve();
                putRequest.onerror = (event) => reject(event.target.error);
            } else {
                resolve();
            }
        };

        getRequest.onerror = (event) => reject(event.target.error);
    });
};
