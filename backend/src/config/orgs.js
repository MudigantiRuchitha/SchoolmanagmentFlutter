module.exports = {
  // Simple whitelist – empty means accept any org code in dev
  allowedOrgs: [],

  /**
   * Checks if the given organization code is in the whitelist.
   * Returns true for any non‑empty string when the whitelist is empty (useful for dev).
   */
  isValid(orgCode) {
    if (!orgCode) return false;
    if (this.allowedOrgs.length === 0) return true;
    return this.allowedOrgs.includes(orgCode.toLowerCase());
  }
};
