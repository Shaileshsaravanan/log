export const formatDate = (date) => {
    var options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
};

export const formatDateTime = (dateTime) => {
    var options = { hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(dateTime).toLocaleString(undefined, options);
};
