import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Saves restaurant coupon details to AsyncStorage if available.
 * If not available, clears the stored coupon keys to ensure stale coupons aren't used.
 *
 * Stored keys:
 * - couponCode & coupencode
 * - offerType & offertype
 * - offerValue & offervalue
 * - restaurant_coupon (JSON object)
 * - restaurant_coupons (JSON array)
 *
 * @param {Array|Object} couponsOrRestaurant Array of coupons or an object containing coupons
 */
export const saveRestaurantCouponToStorage = async (couponsOrRestaurant) => {
  try {
    let coupons = [];
    if (couponsOrRestaurant) {
      if (Array.isArray(couponsOrRestaurant)) {
        coupons = couponsOrRestaurant;
      } else if (Array.isArray(couponsOrRestaurant.coupons)) {
        coupons = couponsOrRestaurant.coupons;
      } else if (couponsOrRestaurant.couponCode || couponsOrRestaurant.coupencode) {
        coupons = [couponsOrRestaurant];
      }
    }

    const activeCoupon = coupons && coupons.length > 0 ? coupons[0] : null;

    if (activeCoupon && (activeCoupon.couponCode || activeCoupon.coupencode)) {
      const code = String(activeCoupon.couponCode || activeCoupon.coupencode || '').trim();
      const type = String(activeCoupon.offerType || activeCoupon.offertype || '').trim();
      const val = String(activeCoupon.offerValue !== undefined ? activeCoupon.offerValue : (activeCoupon.offervalue ?? '')).trim();

      const itemsToSet = [
        ['couponCode', code],
        ['coupencode', code],
        ['offerType', type],
        ['offertype', type],
        ['offerValue', val],
        ['offervalue', val],
        ['restaurant_coupon', JSON.stringify(activeCoupon)],
        ['restaurant_coupons', JSON.stringify(coupons)],
      ];

      await AsyncStorage.multiSet(itemsToSet);
      console.log('[Storage] Saved restaurant coupon to AsyncStorage:', {
        couponCode: code,
        offerType: type,
        offerValue: val,
      });
      return { success: true, saved: true, coupon: { couponCode: code, offerType: type, offerValue: val } };
    } else {
      await AsyncStorage.multiRemove([
        'couponCode',
        'coupencode',
        'offerType',
        'offertype',
        'offerValue',
        'offervalue',
        'restaurant_coupon',
        'restaurant_coupons',
      ]);
      console.log('[Storage] No coupon available for this restaurant. Cleared coupon from AsyncStorage.');
      return { success: true, saved: false };
    }
  } catch (err) {
    console.warn('[Storage] Error saving restaurant coupon to AsyncStorage:', err);
    return { success: false, error: err };
  }
};

/**
 * Retrieves the stored restaurant coupon from AsyncStorage.
 */
export const getStoredRestaurantCoupon = async () => {
  try {
    const [code, type, val] = await Promise.all([
      AsyncStorage.getItem('couponCode').then((v) => v || AsyncStorage.getItem('coupencode')),
      AsyncStorage.getItem('offerType').then((v) => v || AsyncStorage.getItem('offertype')),
      AsyncStorage.getItem('offerValue').then((v) => v || AsyncStorage.getItem('offervalue')),
    ]);

    if (code) {
      return {
        couponCode: code,
        offerType: type || '',
        offerValue: val || '',
      };
    }
    return null;
  } catch (err) {
    console.warn('[Storage] Error reading stored restaurant coupon:', err);
    return null;
  }
};

/**
 * Clears all restaurant and applied coupon details from AsyncStorage.
 */
export const clearRestaurantCoupon = async () => {
  try {
    await AsyncStorage.multiRemove([
      'couponCode',
      'coupencode',
      'offerType',
      'offertype',
      'offerValue',
      'offervalue',
      'restaurant_coupon',
      'restaurant_coupons',
      'applied_coupon',
    ]);
    console.log('[Storage] Cleared restaurant and applied coupon from AsyncStorage.');
    return true;
  } catch (err) {
    console.warn('[Storage] Error clearing restaurant coupon from AsyncStorage:', err);
    return false;
  }
};

