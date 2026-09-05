import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_URL } from '../config';

export const loadCachedRestaurants = createAsyncThunk(
  'restaurants/loadCachedRestaurants',
  async () => {
    try {
      const cachedStr = await AsyncStorage.getItem('cached_restaurants_data');
      const cachedMenusStr = await AsyncStorage.getItem('cached_menus_data');
      let menus = {};
      if (cachedMenusStr) {
        try { menus = JSON.parse(cachedMenusStr); } catch (e) {}
      }
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        return {
          restaurants: parsed.restaurants || [],
          carousel: parsed.carousel || [],
          categories: parsed.categories || [],
          menus: menus || {}
        };
      }
    } catch (e) {
      console.warn('[Restaurants] Cache load error:', e);
    }
    return null;
  }
);

export const fetchAllRestaurantMenus = createAsyncThunk(
  'restaurants/fetchAllRestaurantMenus',
  async (restaurantsList, { getState }) => {
    try {
      if (!Array.isArray(restaurantsList) || restaurantsList.length === 0) return {};
      const state = getState();
      const existingMenus = state.restaurants?.menus || {};

      const missingRestaurants = restaurantsList.filter((rest) => {
        const id = rest.restId || rest._id;
        return id && (!existingMenus[id] || existingMenus[id].length === 0);
      });

      if (missingRestaurants.length === 0) return {};

      const newMenus = {};
      const fetchPromises = missingRestaurants.map(async (rest) => {
        const id = rest.restId || rest._id;
        if (!id) return;
        try {
          const res = await fetch(`${API_URL}/restaurants/${id}/menu`);
          if (res.ok) {
            const data = await res.json();
            newMenus[id] = data.items || [];
          }
        } catch (e) {
          newMenus[id] = [];
        }
      });
      await Promise.all(fetchPromises);
      AsyncStorage.setItem('cached_menus_data', JSON.stringify({ ...existingMenus, ...newMenus })).catch(() => {});
      return newMenus;
    } catch (err) {
      return {};
    }
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
            carousel = carouselData.carousel;
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
            categories = categoriesData.categories;
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

export const fetchRestaurantMenu = createAsyncThunk(
  'restaurants/fetchRestaurantMenu',
  async (restaurantId, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/restaurants/${restaurantId}/menu`);
      if (!response.ok) return { restaurantId, items: [] };
      const data = await response.json();
      return { restaurantId, items: data.items || [] };
    } catch (err) {
      return { restaurantId, items: [] };
    }
  }
);

export const pollRestaurantMenu = createAsyncThunk(
  'restaurants/pollRestaurantMenu',
  async (restaurantId, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/restaurants/${restaurantId}/menu`);
      if (!response.ok) return { restaurantId, items: [] };
      const data = await response.json();
      return { restaurantId, items: data.items || [] };
    } catch (err) {
      return { restaurantId, items: [] };
    }
  }
);

export const fetchProfileData = createAsyncThunk(
  'restaurants/fetchProfileData',
  async (userid, { rejectWithValue }) => {
    try {
      let orders = [];
      let reviews = [];

      try {
        const ordersRes = await fetch(`${API_URL}/orders/completed/${userid}`);
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          orders = ordersData.orders || [];
        }
      } catch (e) {
        console.warn('[Restaurants] Orders fetch error:', e);
      }

      try {
        const reviewsRes = await fetch(`${API_URL}/reviews/user/${userid}`);
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          reviews = reviewsData.reviews || [];
        }
      } catch (e) {
        console.warn('[Restaurants] Reviews fetch error:', e);
      }

      return { orders, reviews };
    } catch (err) {
      return { orders: [], reviews: [] };
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
    menuLoading: {},   // Loading state by restaurantId: { [restaurantId]: boolean }
    orders: [],        // Cache of completed orders
    reviews: [],       // Cache of user reviews
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
    resetProfile: (state) => {
      state.orders = [];
      state.reviews = [];
      state.profileLoaded = false;
      state.profileLoading = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadCachedRestaurants.fulfilled, (state, action) => {
        if (action.payload) {
          if (action.payload.menus) {
            state.menus = { ...state.menus, ...action.payload.menus };
          }
          if (action.payload.restaurants && action.payload.restaurants.length > 0 && !state.initialLoaded) {
            state.list = action.payload.restaurants;
            state.carousel = action.payload.carousel;
            state.categories = action.payload.categories;
            state.initialLoaded = true;
          }
        }
      })
      .addCase(fetchAllRestaurantMenus.fulfilled, (state, action) => {
        if (action.payload) {
          state.menus = { ...state.menus, ...action.payload };
        }
      })
      .addCase(fetchRestaurants.pending, (state) => {
        if (!state.initialLoaded) {
          state.loading = true;
        }
      })
      .addCase(fetchRestaurants.fulfilled, (state, action) => {
        state.list = action.payload.restaurants || [];
        state.carousel = action.payload.carousel || [];
        state.categories = action.payload.categories || [];
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
        const { restaurantId, items } = action.payload;
        state.menus[restaurantId] = items;
        state.menuLoading[restaurantId] = false;
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
        state.reviews = action.payload.reviews || [];
        state.profileLoading = false;
        state.profileLoaded = true;
        state.error = null;
      })
      .addCase(fetchProfileData.rejected, (state, action) => {
        state.profileLoading = false;
        state.error = action.payload;
      })
      .addCase(pollRestaurantMenu.fulfilled, (state, action) => {
        const { restaurantId, items } = action.payload;
        state.menus[restaurantId] = items;
        state.error = null;
      });
  },
});

export const { updateRestaurantStatuses, setRestaurantsList, resetProfile } = restaurantsSlice.actions;
export default restaurantsSlice.reducer;
