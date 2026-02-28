const dns = require('dns').promises;

/**
 * Checks if the system has an active internet connection by attempting
 * to lookup 'google.com'. This is part of the hybrid mode logic.
 * @returns {Promise<boolean>} true if online, false if offline.
 */
async function checkInternet() {
    try {
        // Try to resolve google.com
        await dns.lookup('google.com');
        return true; // Lookup successful, system is online
    } catch (error) {
        // Lookup failed, likely offline
        return false;
    }
}

module.exports = {
    checkInternet
};
