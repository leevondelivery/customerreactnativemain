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

// Helper to parse maintenanceMode from various API response shapes.
// Returns true (app runs normally), false (under maintenance), or null (not found in this response).
const parseMaintenanceMode = (data) => {
  if (!data) return null;

  // Array format: [{ key: 'maintenanceMode', status: true }, ...]
  let controlsArr = null;
  if (Array.isArray(data)) controlsArr = data;
  else if (Array.isArray(data.controls)) controlsArr = data.controls;
  else if (Array.isArray(data.data)) controlsArr = data.data;

  if (controlsArr) {
    const item = controlsArr.find(
      (c) =>
        String(c.key || '').toLowerCase() === 'maintenancemode' ||
        String(c.name || '').toLowerCase() === 'maintenancemode' ||
        String(c.name || '').toLowerCase() === 'maintenance mode'
    );
    if (item) {
      if (typeof item.status === 'boolean') return item.status;
      if (typeof item.status === 'string') return item.status !== 'false' && item.status !== '0';
      if (typeof item.status === 'number') return item.status === 1;
    }
  }

  // Flat object shapes
  if (typeof data.maintenanceMode === 'boolean') return data.maintenanceMode;
  if (typeof data.controls === 'object' && typeof data.controls.maintenanceMode === 'boolean') {
    return data.controls.maintenanceMode;
  }

  return null;
};

// Thunk: fetch controls status (confirmPayButton + maintenanceMode) from the customer backend
export const fetchControlsStatus = createAsyncThunk(
  'controls/fetchControlsStatus',
  async (_, { rejectWithValue }) => {
    const endpoints = [
      `${API_URL}/api/controls`,
      `${API_URL}/controls`,
      `${API_URL}/api/controls/confirmPayButton`,
      `${API_URL}/api/controls/maintenanceMode`,
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

      let confirmPayEnabled = null;
      let maintenanceMode = null;

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          if (confirmPayEnabled === null) {
            const cpStatus = parseConfirmPayStatus(result.value);
            if (cpStatus !== null) confirmPayEnabled = cpStatus;
          }
          if (maintenanceMode === null) {
            const mmStatus = parseMaintenanceMode(result.value);
            if (mmStatus !== null) maintenanceMode = mmStatus;
          }
        }
      }

      if (confirmPayEnabled === null && maintenanceMode === null) {
        // All endpoints failed/returned nothing - default to allow
        return rejectWithValue('no_data');
      }

      return {
        confirmPayEnabled: confirmPayEnabled !== null ? Boolean(confirmPayEnabled) : true,
        maintenanceMode: maintenanceMode !== null ? Boolean(maintenanceMode) : true,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      return rejectWithValue(err.message);
    }
  }
);

const controlsSlice = createSlice({
  name: 'controls',
  initialState: {
    confirmPayEnabled: true, // true = payment allowed, false = disabled
    maintenanceMode: true,   // true = app runs normally, false = app is under maintenance
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
        state.confirmPayEnabled = Boolean(action.payload.confirmPayEnabled);
        state.maintenanceMode = Boolean(action.payload.maintenanceMode);
        state.lastFetched = Date.now();
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchControlsStatus.rejected, (state, action) => {
        state.loading = false;
        // On network failure keep existing status (don't flip to false/maintenance)
        if (action.payload !== 'no_data') {
          state.error = action.payload;
        }
      });
  },
});

export const { setConfirmPayEnabled } = controlsSlice.actions;
export default controlsSlice.reducer;
