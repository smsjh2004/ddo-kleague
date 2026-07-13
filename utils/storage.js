import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  /**
   * Set key-value pair in AsyncStorage
   */
  setItem: async (key, value) => {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
    } catch (e) {
      console.error(`AsyncStorage write error for key [${key}]:`, e);
    }
  },

  /**
   * Get value from AsyncStorage and try to parse it if it is JSON
   */
  getItem: async (key, defaultValue = null) => {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val === null) return defaultValue;
      try {
        return JSON.parse(val);
      } catch (err) {
        return val; // Return raw string if parsing fails
      }
    } catch (e) {
      console.error(`AsyncStorage read error for key [${key}]:`, e);
      return defaultValue;
    }
  },

  /**
   * Remove item from AsyncStorage
   */
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error(`AsyncStorage remove error for key [${key}]:`, e);
    }
  },

  /**
   * Clear all storage
   */
  clear: async () => {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.error('AsyncStorage clear error:', e);
    }
  }
};
