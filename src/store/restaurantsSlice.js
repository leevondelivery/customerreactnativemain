import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_URL } from '../config';

const sortCarouselItems = (arr) => {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort((a, b) => {
    const posA = parseInt(a.position ?? a.carouselId ?? a.id ?? '999', 10);
    const posB = parseInt(b.position ?? b.carouselId ?? b.id ?? '999', 10);
    return (isNaN(posA) ? 999 : posA) - (isNaN(posB) ? 999 : posB);
  });
};

const sortCategoryItems = (arr) => {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort((a, b) => {
    const posA = parseInt(a.position ?? a.id ?? '999', 10);
    const posB = parseInt(b.position ?? b.id ?? '999', 10);
    return (isNaN(posA) ? 999 : posA) - (isNaN(posB) ? 999 : posB);
  });
};

export const loadCachedRestaurants = createAsyncThunk(
  'restaurants/loadCachedRestaurants',
  async () => {
    try {
      const cachedStr = await AsyncStorage.getItem('cached_restaurants_data');
      const cachedMenusStr = await AsyncStorage.getItem('cached_menus_data');
      const cachedOffersStr = await AsyncStorage.getItem('cached_offers_data');
      let menus = {};
      let offers = {};
      if (cachedMenusStr) {
        try { menus = JSON.parse(cachedMenusStr); } catch (e) {}
      }
      if (cachedOffersStr) {
        try { offers = JSON.parse(cachedOffersStr); } catch (e) {}
      }
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        return {
          restaurants: parsed.restaurants || [],
          carousel: sortCarouselItems(parsed.carousel || []),
          categories: sortCategoryItems(parsed.categories || []),
          menus: menus || {},
          offers: offers || {}
        };
      }
    } catch (e) {
      console.warn('[Restaurants] Cache load error:', e);
    }
    return null;
  }
);

export const fetchRestaurants = createAsyncThunk(
  'restaurants/fetchRestaurants',
  async (_, { rejectWithValue }) => {
    let cachedResult = null;
    try {
      const cachedStr = await AsyncStorage.getItem('cached_restaurants_data');
      if (cachedStr) {
        cachedResult = JSON.parse(cachedStr);
      }
    } catch (e) {}

    let restaurants = cachedResult?.restaurants || [];
    let carousel = cachedResult?.carousel || [];
    let categories = cachedResult?.categories || [];

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
      const fetchOpts = controller ? { signal: controller.signal } : undefined;

      try {
        const restRes = await fetch(`${API_URL}/restaurants`, fetchOpts);
        if (restRes.ok) {
          const restData = await restRes.json();
          if (restData.restaurants && Array.isArray(restData.restaurants)) {
            restaurants = restData.restaurants;
          }
        }
      } catch (e) {
        console.warn('[Restaurants] Restaurants fetch error:', e.message);
      }

      try {
        const carouselRes = await fetch(`${API_URL}/carousel`, fetchOpts);
        if (carouselRes.ok) {
          const carouselData = await carouselRes.json();
          if (carouselData.carousel && Array.isArray(carouselData.carousel)) {
            carousel = sortCarouselItems(carouselData.carousel);
          }
        }
      } catch (e) {
        console.warn('[Restaurants] Carousel fetch error:', e.message);
      }

      try {
        const categoriesRes = await fetch(`${API_URL}/categories`, fetchOpts);
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          if (categoriesData.categories && Array.isArray(categoriesData.categories)) {
            categories = sortCategoryItems(categoriesData.categories);
          }
        }
      } catch (e) {
        console.warn('[Restaurants] Categories fetch error:', e.message);
      }

      if (timeoutId) clearTimeout(timeoutId);

      const freshPayload = { restaurants, carousel, categories };
      AsyncStorage.setItem('cached_restaurants_data', JSON.stringify(freshPayload)).catch(() => {});

      return freshPayload;
    } catch (err) {
      console.warn('[Restaurants] Network fetch error/timeout:', err.message);
      return { restaurants, carousel, categories };
    }
  }
);

export const fetchAllRestaurantMenus = createAsyncThunk(
  'restaurants/fetchAllRestaurantMenus',
  async (restaurantsList, { getState }) => {
    try {
      if (!Array.isArray(restaurantsList) || restaurantsList.length === 0) return { menus: {}, offers: {} };
      const state = getState();
      const existingMenus = state.restaurants?.menus || {};
      const existingOffers = state.restaurants?.offers || {};

      const missingRestaurants = restaurantsList.filter((rest) => {
        const id1 = rest.restId;
        const id2 = rest._id;
        const id3 = rest.id;
        const id4 = rest.restaurantId;
        const has1 = id1 && existingMenus[id1] && existingMenus[id1].length > 0;
        const has2 = id2 && existingMenus[id2] && existingMenus[id2].length > 0;
        const has3 = id3 && existingMenus[id3] && existingMenus[id3].length > 0;
        const has4 = id4 && existingMenus[id4] && existingMenus[id4].length > 0;
        return !has1 && !has2 && !has3 && !has4;
      });

      if (missingRestaurants.length === 0) return { menus: {}, offers: {} };

      const newMenus = {};
      const newOffers = {};

      const fetchMenuAndOffersForRest = async (rest) => {
        const candidateIds = [rest.restId, rest._id, rest.id, rest.restaurantId]
          .filter(Boolean)
          .filter((id, idx, arr) => arr.indexOf(id) === idx);

        for (const id of candidateIds) {
          try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;
            const [menuRes, offersRes] = await Promise.allSettled([
              fetch(`${API_URL}/restaurants/${id}/menu`, { signal: controller?.signal }),
              fetch(`${API_URL}/api/offers/restaurant/${id}`, { signal: controller?.signal }),
            ]);
            if (timeoutId) clearTimeout(timeoutId);

            if (menuRes.status === 'fulfilled' && menuRes.value.ok) {
              const data = await menuRes.value.json();
              const items = data.items || [];
              if (Array.isArray(items) && items.length > 0) {
                if (rest.restId) newMenus[rest.restId] = items;
                if (rest._id) newMenus[rest._id] = items;
                if (rest.id) newMenus[rest.id] = items;
                if (rest.restaurantId) newMenus[rest.restaurantId] = items;
                newMenus[id] = items;
              }
            }

            if (offersRes.status === 'fulfilled' && offersRes.value.ok) {
              const offersData = await offersRes.value.json();
              if (offersData && offersData.success && offersData.data) {
                if (rest.restId) newOffers[rest.restId] = offersData.data;
                if (rest._id) newOffers[rest._id] = offersData.data;
                if (rest.id) newOffers[rest.id] = offersData.data;
                if (rest.restaurantId) newOffers[rest.restaurantId] = offersData.data;
                newOffers[id] = offersData.data;
              }
            }

            if (newMenus[id]) return;
          } catch (_e) {}
        }
      };

      await Promise.all(missingRestaurants.map(rest => fetchMenuAndOffersForRest(rest)));
      AsyncStorage.setItem('cached_menus_data', JSON.stringify({ ...existingMenus, ...newMenus })).catch(() => {});
      AsyncStorage.setItem('cached_offers_data', JSON.stringify({ ...existingOffers, ...newOffers })).catch(() => {});
      return { menus: newMenus, offers: newOffers };
    } catch (_err) {
      return { menus: {}, offers: {} };
    }
  }
);

export const fetchRestaurantMenu = createAsyncThunk(
  'restaurants/fetchRestaurantMenu',
  async (restaurantId, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const restaurants = state.restaurants?.list || [];
      const rest = restaurants.find(r =>
        (r.restId && String(r.restId) === String(restaurantId)) ||
        (r._id && String(r._id) === String(restaurantId)) ||
        (r.id && String(r.id) === String(restaurantId))
      );

      const candidateIds = [
        restaurantId,
        rest?.restId,
        rest?._id,
        rest?.id,
        rest?.restaurantId
      ].filter(Boolean).map(String).filter((id, idx, arr) => arr.indexOf(id) === idx);

      const existing = state.restaurants?.menus?.[restaurantId] ||
                       (rest?.restId && state.restaurants?.menus?.[rest.restId]) ||
                       (rest?._id && state.restaurants?.menus?.[rest._id]) ||
                       [];

      // Helper to fetch menu for a single candidate ID with 4s timeout
      const fetchMenuForId = async (id) => {
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
          const res = await fetch(`${API_URL}/restaurants/${id}/menu`, {
            signal: controller ? controller.signal : undefined,
          });
          if (timeoutId) clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              return data.items;
            }
          }
        } catch (_e) {}
        return null;
      };

      // Helper to fetch offers for a single candidate ID
      const fetchOffersForId = async (id) => {
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
          const res = await fetch(`${API_URL}/api/offers/restaurant/${id}`, {
            signal: controller ? controller.signal : undefined,
          });
          if (timeoutId) clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.data) {
              return data.data;
            }
          }
        } catch (_e) {}
        return null;
      };

      // Fetch all candidate IDs in parallel for maximum speed
      const [menuResults, offersResults] = await Promise.all([
        Promise.all(candidateIds.map(id => fetchMenuForId(id))),
        Promise.all(candidateIds.map(id => fetchOffersForId(id)))
      ]);

      const items = menuResults.find(res => Array.isArray(res) && res.length > 0) || existing;
      const existingOffers = state.restaurants?.offers?.[restaurantId] ||
                             (rest?.restId && state.restaurants?.offers?.[rest.restId]) ||
                             (rest?._id && state.restaurants?.offers?.[rest._id]) ||
                             null;
      const offers = offersResults.find(Boolean) || existingOffers || null;

      if (items.length > 0 || offers) {
        try {
          const existingMenus = state.restaurants?.menus || {};
          const updatedMenus = { ...existingMenus, [restaurantId]: items };
          if (rest?.restId) updatedMenus[rest.restId] = items;
          if (rest?._id) updatedMenus[rest._id] = items;
          AsyncStorage.setItem('cached_menus_data', JSON.stringify(updatedMenus)).catch(() => {});

          if (offers) {
            const existingOffersMap = state.restaurants?.offers || {};
            const updatedOffers = { ...existingOffersMap, [restaurantId]: offers };
            if (rest?.restId) updatedOffers[rest.restId] = offers;
            if (rest?._id) updatedOffers[rest._id] = offers;
            AsyncStorage.setItem('cached_offers_data', JSON.stringify(updatedOffers)).catch(() => {});
          }
        } catch (_e) {}
      }

      return { restaurantId, rest, items, offers };
    } catch (err) {
      return { restaurantId, items: [], offers: null };
    }
  }
);

export const pollRestaurantMenu = createAsyncThunk(
  'restaurants/pollRestaurantMenu',
  async (restaurantId, { getState }) => {
    try {
      const state = getState();
      const restaurants = state.restaurants?.list || [];
      const rest = restaurants.find(r => r.restId === restaurantId || r._id === restaurantId);
      const candidateIds = [restaurantId, rest?.restId, rest?._id].filter(Boolean);

      for (const id of candidateIds) {
        try {
          const response = await fetch(`${API_URL}/restaurants/${id}/menu`);
          if (response.ok) {
            const data = await response.json();
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              return { restaurantId, rest, items: data.items };
            }
          }
        } catch (_e) {}
      }
      return { restaurantId, rest, items: null };
    } catch (err) {
      return { restaurantId, items: null };
    }
  }
);

export const fetchUserReviews = createAsyncThunk(
  'restaurants/fetchUserReviews',
  async (userid, { rejectWithValue }) => {
    try {
      if (!userid) return [];
      const currentUserIdStr = String(userid).trim();
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
      const res = await fetch(`${API_URL}/reviews/user/${currentUserIdStr}`, { signal: controller?.signal });
      if (timeoutId) clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : (data.reviews || data.data || []);
      }
      return [];
    } catch (_err) {
      return [];
    }
  }
);

export const fetchProfileData = createAsyncThunk(
  'restaurants/fetchProfileData',
  async (userid, { rejectWithValue }) => {
    try {
      if (!userid) return { orders: [], reviews: [], userid: '' };
      const currentUserIdStr = String(userid).trim();
      let userPhone = '';
      try {
        userPhone = (await AsyncStorage.getItem('phone')) || '';
        userPhone = String(userPhone).replace(/\D/g, '').slice(-10);
      } catch (e) {}

      let orders = [];
      let serverReviews = [];
      let localReviews = [];

      // 1. Load locally submitted reviews from AsyncStorage
      try {
        const storedLocals = await AsyncStorage.getItem('locally_submitted_reviews');
        if (storedLocals) {
          const parsed = JSON.parse(storedLocals);
          if (Array.isArray(parsed)) {
            localReviews = parsed.filter((r) => {
              if (!r) return false;
              const rUid = String(r.userId || r.user_id || '').trim();
              return !rUid || rUid === currentUserIdStr || (userPhone && rUid.includes(userPhone));
            });
          }
        }
      } catch (e) {
        console.warn('[Restaurants] Local reviews load error:', e);
      }

      // Helper to create independent AbortController with 4s timeout
      const createController = (ms = 4000) => {
        if (typeof AbortController !== 'undefined') {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), ms);
          return { signal: c.signal, clear: () => clearTimeout(t) };
        }
        return { signal: undefined, clear: () => {} };
      };

      const ordersCtrl = createController(4000);
      const reviewsCtrl = createController(4000);

      // 2 & 3. Fetch orders and reviews in parallel
      const [ordersResSettled, reviewsResSettled] = await Promise.allSettled([
        fetch(`${API_URL}/orders/completed/${currentUserIdStr}`, { signal: ordersCtrl.signal }),
        fetch(`${API_URL}/reviews/user/${currentUserIdStr}`, { signal: reviewsCtrl.signal }),
      ]);
      ordersCtrl.clear();
      reviewsCtrl.clear();

      if (ordersResSettled.status === 'fulfilled' && ordersResSettled.value.ok) {
        try {
          const ordersData = await ordersResSettled.value.json();
          const rawOrders = ordersData.orders || ordersData.data || (Array.isArray(ordersData) ? ordersData : []);
          orders = Array.isArray(rawOrders) ? rawOrders.filter(o => {
            if (!o) return false;
            const oUid = String(o.userId || o.user_id || o.userid || o.customerId || o.customer_id || '').trim();
            if (!oUid) return true;
            return oUid === currentUserIdStr || (userPhone && (oUid.includes(userPhone) || userPhone.includes(oUid.replace(/\D/g, ''))));
          }) : [];
        } catch (e) {}
      }

      if (reviewsResSettled.status === 'fulfilled' && reviewsResSettled.value.ok) {
        try {
          const reviewsData = await reviewsResSettled.value.json();
          const rawReviews = Array.isArray(reviewsData)
            ? reviewsData
            : (reviewsData.reviews || reviewsData.data || reviewsData.userReviews || []);
          serverReviews = Array.isArray(rawReviews) ? rawReviews : [];
        } catch (e) {}
      }

      // 4. Merge local reviews with server reviews (preventing duplicate orderIds)
      const mergedReviews = [
        ...localReviews,
        ...serverReviews.filter(sr => {
          if (!sr) return false;
          const srOrderId = String(sr.orderId || sr.order_id || '').replace(/^ord-/i, '').trim();
          return !localReviews.some(lr => {
            const lrOrderId = String(lr.orderId || lr.order_id || '').replace(/^ord-/i, '').trim();
            const matchOrder = Boolean(srOrderId && lrOrderId && srOrderId === lrOrderId);
            const matchId = Boolean(sr._id && lr._id && String(sr._id) === String(lr._id));
            return matchOrder || matchId;
          });
        })
      ];

      return { orders, reviews: mergedReviews, userid: currentUserIdStr };
    } catch (err) {
      return { orders: [], reviews: [], userid: String(userid || '') };
    }
  }
);

const restaurantsSlice = createSlice({
  name: 'restaurants',
  initialState: {
    list: [],
    carousel: [],      // Cache of carousel items
    categories: [],    // Cache of category filters
    menus: {},         // Cache of menus: { [restaurantId]: [item1, item2, ...] }
    offers: {},        // Cache of restaurant offers: { [restaurantId]: { bogoOffers, categoryDiscounts, tieredOffers } }
    menuLoading: {},   // Loading state by restaurantId: { [restaurantId]: boolean }
    orders: [],        // Cache of completed orders
    reviews: [],       // Cache of user reviews (Redux Store)
    reviewsLoaded: false,
    reviewsLoading: false,
    profileLoadedUserId: null, // Current loaded profile user id
    profileLoaded: false, // Track if profile data is loaded
    profileLoading: false, // Track profile loading state
    loading: false,
    initialLoaded: false,
    error: null,
  },
  reducers: {
    updateRestaurantStatuses: (state, action) => {
      const polledList = action.payload;
      state.list = state.list.map(existing => {
        const found = polledList.find(p => (p._id && p._id === existing._id) || (p.restId && p.restId === existing.restId));
        if (found) {
          const isAct = found.isActive !== false && found.isActive !== 'false' && found.isactive !== false && found.isactive !== 'false' && found.isActive !== 0 && found.isactive !== 0 && found.status !== 'closed' && found.status !== 'INACTIVE';
          return {
            ...existing,
            ...found,
            isActive: isAct,
            isactive: isAct,
          };
        }
        return existing;
      });
    },
    setRestaurantsList: (state, action) => {
      state.list = action.payload;
      state.initialLoaded = true;
    },
    addReviewLocally: (state, action) => {
      const newRev = action.payload;
      if (!newRev) return;
      const orderIdStr = String(newRev.orderId || newRev.order_id || '').trim();
      const filtered = (state.reviews || []).filter(r => {
        const rOrd = String(r.orderId || r.order_id || '').trim();
        return !(rOrd && orderIdStr && rOrd === orderIdStr);
      });
      state.reviews = [newRev, ...filtered];
    },
    resetProfile: (state) => {
      state.orders = [];
      state.reviews = [];
      state.profileLoaded = false;
      state.profileLoading = false;
      state.profileLoadedUserId = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadCachedRestaurants.fulfilled, (state, action) => {
        if (action.payload) {
          if (action.payload.menus) {
            state.menus = { ...state.menus, ...action.payload.menus };
          }
          if (action.payload.offers) {
            state.offers = { ...state.offers, ...action.payload.offers };
          }
          if (action.payload.restaurants && action.payload.restaurants.length > 0 && !state.initialLoaded) {
            state.list = action.payload.restaurants;
            state.carousel = sortCarouselItems(action.payload.carousel);
            state.categories = sortCategoryItems(action.payload.categories);
            state.initialLoaded = true;
          }
        }
      })
      .addCase(fetchAllRestaurantMenus.fulfilled, (state, action) => {
        if (action.payload) {
          if (action.payload.menus) {
            state.menus = { ...state.menus, ...action.payload.menus };
          }
          if (action.payload.offers) {
            state.offers = { ...state.offers, ...action.payload.offers };
          }
        }
      })
      .addCase(fetchRestaurants.pending, (state) => {
        if (!state.initialLoaded) {
          state.loading = true;
        }
      })
      .addCase(fetchRestaurants.fulfilled, (state, action) => {
        state.list = action.payload.restaurants || [];
        state.carousel = sortCarouselItems(action.payload.carousel);
        state.categories = sortCategoryItems(action.payload.categories);
        state.loading = false;
        state.initialLoaded = true;
        state.error = null;
      })
      .addCase(fetchRestaurants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchRestaurantMenu.pending, (state, action) => {
        const restaurantId = action.meta.arg;
        state.menuLoading[restaurantId] = true;
      })
      .addCase(fetchRestaurantMenu.fulfilled, (state, action) => {
        const { restaurantId, rest, items, offers } = action.payload;
        if (items && items.length > 0) {
          state.menus[restaurantId] = items;
          if (rest?.restId) state.menus[rest.restId] = items;
          if (rest?._id) state.menus[rest._id] = items;
        } else if (!state.menus[restaurantId] || state.menus[restaurantId].length === 0) {
          state.menus[restaurantId] = items || [];
          if (rest?.restId && !state.menus[rest.restId]) state.menus[rest.restId] = items || [];
          if (rest?._id && !state.menus[rest._id]) state.menus[rest._id] = items || [];
        }

        if (offers) {
          state.offers[restaurantId] = offers;
          if (rest?.restId) state.offers[rest.restId] = offers;
          if (rest?._id) state.offers[rest._id] = offers;
        }

        state.menuLoading[restaurantId] = false;
        if (rest?.restId) state.menuLoading[rest.restId] = false;
        if (rest?._id) state.menuLoading[rest._id] = false;
        state.error = null;
      })
      .addCase(fetchRestaurantMenu.rejected, (state, action) => {
        const restaurantId = action.meta.arg;
        state.menuLoading[restaurantId] = false;
        state.error = action.payload;
      })
      .addCase(fetchProfileData.pending, (state) => {
        state.profileLoading = true;
      })
      .addCase(fetchProfileData.fulfilled, (state, action) => {
        state.orders = action.payload.orders || [];
        const incomingReviews = action.payload.reviews || [];
        const existingReviews = state.reviews || [];
        // Merge without losing any local reviews that were already added
        const mergedRev = [
          ...incomingReviews,
          ...existingReviews.filter((er) => {
            if (!er) return false;
            const erOrderId = String(er.orderId || er.order_id || '').replace(/^ord-/i, '').trim();
            return !incomingReviews.some((ir) => {
              const irOrderId = String(ir.orderId || ir.order_id || '').replace(/^ord-/i, '').trim();
              const sameOrder = Boolean(erOrderId && irOrderId && erOrderId === irOrderId);
              const sameId = Boolean(er._id && ir._id && String(er._id) === String(ir._id));
              return sameOrder || sameId;
            });
          })
        ];
        state.reviews = mergedRev;
        state.profileLoadedUserId = action.payload.userid || null;
        state.profileLoading = false;
        state.profileLoaded = true;
        state.error = null;
      })
      .addCase(fetchProfileData.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileLoaded = true;
        state.error = action.payload;
      })
      .addCase(fetchUserReviews.pending, (state) => {
        state.reviewsLoading = true;
      })
      .addCase(fetchUserReviews.fulfilled, (state, action) => {
        const incoming = Array.isArray(action.payload) ? action.payload : [];
        if (incoming.length > 0) {
          const existing = state.reviews || [];
          const merged = [
            ...incoming,
            ...existing.filter((er) => {
              if (!er) return false;
              const erOrderId = String(er.orderId || er.order_id || '').replace(/^ord-/i, '').trim();
              return !incoming.some((ir) => {
                const irOrderId = String(ir.orderId || ir.order_id || '').replace(/^ord-/i, '').trim();
                return Boolean(erOrderId && irOrderId && erOrderId === irOrderId) || (er._id && ir._id && String(er._id) === String(ir._id));
              });
            })
          ];
          state.reviews = merged;
        }
        state.reviewsLoading = false;
        state.reviewsLoaded = true;
      })
      .addCase(fetchUserReviews.rejected, (state) => {
        state.reviewsLoading = false;
        state.reviewsLoaded = true;
      })
      .addCase(pollRestaurantMenu.fulfilled, (state, action) => {
        const { restaurantId, rest, items } = action.payload;
        if (items && items.length > 0) {
          state.menus[restaurantId] = items;
          if (rest?.restId) state.menus[rest.restId] = items;
          if (rest?._id) state.menus[rest._id] = items;
        }
        state.error = null;
      });
  },
});

export const { updateRestaurantStatuses, setRestaurantsList, addReviewLocally, resetProfile } = restaurantsSlice.actions;
export default restaurantsSlice.reducer;
