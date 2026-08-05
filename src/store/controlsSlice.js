import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_URL } from '../config';

// Helper to parse confirmPayButton status from various API response shapes
const parseConfirmPayStatus = (data) => {
  if (!data) return null;

  // Array format: [{ key: 'confirmPayButton', status: false }, ...]
  let controlsArr = null;
  if (Array.isArray(data)) controlsArr = data;
  else if (Array.isArray(data.controls)) controlsArr = data.controls;
  else if (Array.isArray(data.data)) controlsArr = data.data;

  if (controlsArr) {
    const item = controlsArr.find(
      (c) =>
        String(c.key || '').toLowerCase() === 'confirmpaybutton' ||
        String(c.name || '').toLowerCase() === 'confirm pay button'
    );
    if (item) {
      if (typeof item.status === 'boolean') return item.status;
      if (typeof item.status === 'string') return item.status !== 'false' && item.status !== '0';
      if (typeof item.status === 'number') return item.status === 1;
    }
  }

  // Single object: { key: 'confirmPayButton', status: false }
  if (typeof data.status === 'boolean' && (data.key === 'confirmPayButton' || data.name === 'Confirm Pay Button')) {
    return data.status;
  }
  if (typeof data.confirmPayButton === 'boolean') return data.confirmPayButton;
  if (typeof data.controls === 'object' && typeof data.controls.confirmPayButton === 'boolean') {
    return data.controls.confirmPayButton;
  }

  return null;
};

// Thunk: fetch confirmPayButton status from the customer backend
export const fetchControlsStatus = createAsyncThunk(
  'controls/fetchControlsStatus',
  async (_, { rejectWithValue }) => {
    const endpoints = [
      `${API_URL}/api/controls`,
      `${API_URL}/controls`,
      `${API_URL}/api/controls/confirmPayButton`,
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const results = await Promise.allSettled(
        endpoints.map((url) =>
          fetch(`${url}?t=${Date.now()}`, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
          }).then((res) => (res.ok ? res.json() : null))
        )
      );

      clearTimeout(timeoutId);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const status = parseConfirmPayStatus(result.value);
          if (status !== null) {
            return Boolean(status);
          }
        }
      }

      // All endpoints failed/returned nothing - default to allow
      return rejectWithValue('no_data');
    } catch (err) {
      clearTimeout(timeoutId);
      return rejectWithValue(err.message);
    }
  }
);

const controlsSlice = createSlice({
  name: 'controls',
  initialState: {
    confirmPayEnabled: true, // true = payment allowed, false = maintenance
    lastFetched: null,
    loading: false,
    error: null,
  },
  reducers: {
    setConfirmPayEnabled: (state, action) => {
      state.confirmPayEnabled = Boolean(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchControlsStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchControlsStatus.fulfilled, (state, action) => {
        state.confirmPayEnabled = Boolean(action.payload);
        state.lastFetched = Date.now();
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchControlsStatus.rejected, (state, action) => {
        state.loading = false;
        // On network failure keep existing status (don't flip to false)
        if (action.payload !== 'no_data') {
          state.error = action.payload;
        }
      });
  },
});

export const { setConfirmPayEnabled } = controlsSlice.actions;
export default controlsSlice.reducer;
