
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_URL } from '../config';

export const fetchRestaurants = createAsyncThunk(
  'restaurants/fetchRestaurants',
  async (_, { rejectWithValue }) => {
    try {
      const [restRes, carouselRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/restaurants`),
        fetch(`${API_URL}/carousel`),
        fetch(`${API_URL}/categories`)
      ]);
      if (!restRes.ok) throw new Error('Failed to fetch restaurants');
      if (!carouselRes.ok) throw new Error('Failed to fetch carousel');
      if (!categoriesRes.ok) throw new Error('Failed to fetch categories');
      const [restData, carouselData, categoriesData] = await Promise.all([
        restRes.json(),
        carouselRes.json(),
        categoriesRes.json()
      ]);
      return {
        restaurants: restData.restaurants || [],
        carousel: carouselData.carousel || [],
        categories: categoriesData.categories || []
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchRestaurantMenu = createAsyncThunk(
  'restaurants/fetchRestaurantMenu',
  async (restaurantId, { rejectWithValue, getState }) => {
    const state = getState();
    if (state.restaurants.menus && state.restaurants.menus[restaurantId]) {
      return { restaurantId, items: state.restaurants.menus[restaurantId], fromCache: true };
    }
    try {
      const response = await fetch(`${API_URL}/restaurants/${restaurantId}/menu`);
      if (!response.ok) throw new Error('Failed to fetch menu');
      const data = await response.json();
      return { restaurantId, items: data.items || [] };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const pollRestaurantMenu = createAsyncThunk(
  'restaurants/pollRestaurantMenu',
  async (restaurantId, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/restaurants/${restaurantId}/menu`);
      if (!response.ok) throw new Error('Failed to fetch menu');
      const data = await response.json();
      return { restaurantId, items: data.items || [] };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchProfileData = createAsyncThunk(
  'restaurants/fetchProfileData',
  async (userid, { rejectWithValue }) => {
    try {
      const [ordersRes, reviewsRes] = await Promise.all([
        fetch(`${API_URL}/orders/completed/${userid}`),
        fetch(`${API_URL}/reviews/user/${userid}`)
      ]);
      if (!ordersRes.ok) throw new Error('Failed to fetch completed orders');
      if (!reviewsRes.ok) throw new Error('Failed to fetch reviews');
      const [ordersData, reviewsData] = await Promise.all([
        ordersRes.json(),
        reviewsRes.json()
      ]);
      return {
        orders: ordersData.orders || [],
        reviews: reviewsData.reviews || []
      };
    } catch (err) {
      return rejectWithValue(err.message);
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
        const found = polledList.find(p => p._id === existing._id);
        if (found) {
          return {
            ...existing,
            isActive: found.isActive !== false && found.isactive !== false,
            isactive: found.isActive !== false && found.isactive !== false,
          };
        }
        return existing;
      });
    },
    setRestaurantsList: (state, action) => {
      state.list = action.payload;
      state.initialLoaded = true;
    }
  },
  extraReducers: (builder) => {
    builder
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
        const { restaurantId, items, fromCache } = action.payload;
        if (!fromCache) {
          state.menus[restaurantId] = items;
        }
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

export const { updateRestaurantStatuses, setRestaurantsList } = restaurantsSlice.actions;
export default restaurantsSlice.reducer;
