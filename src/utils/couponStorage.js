import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Saves restaurant coupon details to AsyncStorage if available.
 * If not available, clears the stored coupon keys to ensure stale coupons aren't used.
 *
 * Stored keys:
 * - couponCode & coupencode
 * - offerType & offertype
 * - offerValue & offervalue
 * - coupon_restaurant_id
 * - restaurant_coupon (JSON object)
 * - restaurant_coupons (JSON array)
 *
 * @param {Array|Object} couponsOrRestaurant Array of coupons or an object containing coupons
 * @param {string} [restId] Optional restaurant ID to bind this coupon to
 */
export const saveRestaurantCouponToStorage = async (couponsOrRestaurant, restId = '') => {
  try {
    let coupons = [];
    let extractedRestId = String(restId || '').trim();

    if (couponsOrRestaurant) {
      if (!extractedRestId) {
        extractedRestId = String(
          couponsOrRestaurant.restId ||
          couponsOrRestaurant.restaurantId ||
          couponsOrRestaurant._id ||
          ''
        ).trim();
      }

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
        ['coupon_restaurant_id', extractedRestId],
        ['restaurant_coupon', JSON.stringify({ ...activeCoupon, restId: extractedRestId })],
        ['restaurant_coupons', JSON.stringify(coupons)],
      ];

      await AsyncStorage.multiSet(itemsToSet);
      console.log('[Storage] Saved restaurant coupon to AsyncStorage:', {
        couponCode: code,
        offerType: type,
        offerValue: val,
        restaurantId: extractedRestId,
      });
      return { success: true, saved: true, coupon: { couponCode: code, offerType: type, offerValue: val, restId: extractedRestId } };
    } else {
      const storedRestId = await AsyncStorage.getItem('coupon_restaurant_id');
      if (!storedRestId || !extractedRestId || String(storedRestId).trim() === String(extractedRestId).trim()) {
        await AsyncStorage.multiRemove([
          'couponCode',
          'coupencode',
          'offerType',
          'offertype',
          'offerValue',
          'offervalue',
          'coupon_restaurant_id',
          'restaurant_coupon',
          'restaurant_coupons',
        ]);
        console.log('[Storage] No coupon available for this restaurant. Cleared coupon from AsyncStorage.');
        return { success: true, saved: false };
      } else {
        console.log(`[Storage] Preserved stored coupon for restId ${storedRestId} while browsing restId ${extractedRestId}.`);
        return { success: true, saved: false, preserved: true };
      }
    }
  } catch (err) {
    console.warn('[Storage] Error saving restaurant coupon to AsyncStorage:', err);
    return { success: false, error: err };
  }
};

/**
 * Retrieves the stored restaurant coupon from AsyncStorage.
 * @param {string} [currentRestId] Optional current restaurant ID to validate against
 */
export const getStoredRestaurantCoupon = async (currentRestId = '') => {
  try {
    const [code, type, val, storedRestId] = await Promise.all([
      AsyncStorage.getItem('couponCode').then((v) => v || AsyncStorage.getItem('coupencode')),
      AsyncStorage.getItem('offerType').then((v) => v || AsyncStorage.getItem('offertype')),
      AsyncStorage.getItem('offerValue').then((v) => v || AsyncStorage.getItem('offervalue')),
      AsyncStorage.getItem('coupon_restaurant_id'),
    ]);

    const reqRestId = String(currentRestId || '').trim();
    const stRestId = String(storedRestId || '').trim();

    if (reqRestId && stRestId && reqRestId !== stRestId) {
      console.log(`[Storage] Stored coupon belongs to restId ${stRestId}, but current cart restId is ${reqRestId}. Clearing stale coupon.`);
      await clearRestaurantCoupon();
      return null;
    }

    if (code) {
      return {
        couponCode: code,
        offerType: type || '',
        offerValue: val || '',
        restId: stRestId,
      };
    }
    return null;
  } catch (err) {
    console.warn('[Storage] Error reading stored restaurant coupon:', err);
    return null;
  }
};

/**
 * Clears restaurant offer coupon details from AsyncStorage without wiping applied_coupon.
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
      'coupon_restaurant_id',
      'restaurant_coupon',
      'restaurant_coupons',
    ]);
    console.log('[Storage] Cleared restaurant offer coupon from AsyncStorage.');
    return true;
  } catch (err) {
    console.warn('[Storage] Error clearing restaurant coupon from AsyncStorage:', err);
    return false;
  }
};

