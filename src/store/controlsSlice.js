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
      let status = null;
      if (typeof item.status === 'boolean') status = item.status;
      else if (typeof item.status === 'string') status = item.status !== 'false' && item.status !== '0';
      else if (typeof item.status === 'number') status = item.status === 1;

      return {
        status,
        title: item.title || item.alertTitle || '',
        description: item.description || item.message || ''
      };
    }
  }

  // Single object: { key: 'confirmPayButton', status: false }
  if (typeof data.status === 'boolean' && (data.key === 'confirmPayButton' || data.name === 'Confirm Pay Button')) {
    return {
      status: data.status,
      title: data.title || data.control?.title || '',
      description: data.description || data.control?.description || ''
    };
  }
  if (typeof data.confirmPayButton === 'boolean') {
    return {
      status: data.confirmPayButton,
      title: data.title || data.controls?.confirmPayButtonTitle || '',
      description: data.description || data.controls?.confirmPayButtonDescription || ''
    };
  }
  if (typeof data.controls === 'object' && typeof data.controls.confirmPayButton === 'boolean') {
    return {
      status: data.controls.confirmPayButton,
      title: data.controls?.title || data.title || '',
      description: data.controls?.description || data.description || ''
    };
  }
  if (data.control && (data.control.key === 'confirmPayButton' || data.control.name === 'Confirm Pay Button')) {
    return {
      status: typeof data.status === 'boolean' ? data.status : Boolean(data.control.status),
      title: data.title || data.control.title || '',
      description: data.description || data.control.description || ''
    };
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

// Helper to parse homeHangingBanner status from various API response shapes
const parseHomeBannerStatus = (data) => {
  if (!data) return null;

  let controlsArr = null;
  if (Array.isArray(data)) controlsArr = data;
  else if (Array.isArray(data.controls)) controlsArr = data.controls;
  else if (Array.isArray(data.data)) controlsArr = data.data;

  if (controlsArr) {
    const item = controlsArr.find(
      (c) =>
        String(c.key || '').toLowerCase() === 'homehangingbanner' ||
        String(c.key || '').toLowerCase() === 'hangingbanner' ||
        String(c.name || '').toLowerCase() === 'home hanging banner'
    );
    if (item) {
      let status = false;
      if (typeof item.status === 'boolean') status = item.status;
      else if (typeof item.status === 'string') status = item.status !== 'false' && item.status !== '0';
      else if (typeof item.status === 'number') status = item.status === 1;

      return {
        status,
        title: item.title || '',
        description: item.description || item.message || ''
      };
    }
  }

  if (data.key === 'homeHangingBanner' || data.name === 'Home Hanging Banner' || data.key === 'hangingBanner') {
    return {
      status: typeof data.status === 'boolean' ? data.status : Boolean(data.status),
      title: data.title || data.control?.title || '',
      description: data.description || data.control?.description || ''
    };
  }
  if (data.control && (data.control.key === 'homeHangingBanner' || data.control.key === 'hangingBanner' || data.control.name === 'Home Hanging Banner')) {
    return {
      status: typeof data.status === 'boolean' ? data.status : Boolean(data.control.status),
      title: data.title || data.control.title || '',
      description: data.description || data.control.description || ''
    };
  }

  return null;
};

// Thunk: fetch controls status (confirmPayButton + maintenanceMode + homeHangingBanner) from the customer backend
export const fetchControlsStatus = createAsyncThunk(
  'controls/fetchControlsStatus',
  async (_, { rejectWithValue }) => {
    const endpoints = [
      `${API_URL}/api/controls`,
      `${API_URL}/controls`,
      `${API_URL}/api/controls/confirmPayButton`,
      `${API_URL}/api/controls/maintenanceMode`,
      `${API_URL}/api/controls/homeHangingBanner`,
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
      let confirmPayDisabledTitle = '';
      let confirmPayDisabledMessage = '';
      let maintenanceMode = null;
      let homeBannerStatus = null;
      let homeBannerTitle = '';
      let homeBannerText = '';

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          if (confirmPayEnabled === null) {
            const cpData = parseConfirmPayStatus(result.value);
            if (cpData !== null && cpData.status !== null) {
              confirmPayEnabled = cpData.status;
              if (cpData.title) {
                confirmPayDisabledTitle = cpData.title;
              }
              if (cpData.description) {
                confirmPayDisabledMessage = cpData.description;
              }
            }
          }
          if (maintenanceMode === null) {
            const mmStatus = parseMaintenanceMode(result.value);
            if (mmStatus !== null) maintenanceMode = mmStatus;
          }
          if (homeBannerStatus === null) {
            const hbData = parseHomeBannerStatus(result.value);
            if (hbData !== null && hbData.status !== null) {
              homeBannerStatus = hbData.status;
              if (hbData.title) homeBannerTitle = hbData.title;
              if (hbData.description) homeBannerText = hbData.description;
            }
          }
        }
      }

      if (confirmPayEnabled === null && maintenanceMode === null && homeBannerStatus === null) {
        // All endpoints failed/returned nothing - default to allow
        return rejectWithValue('no_data');
      }

      return {
        confirmPayEnabled: confirmPayEnabled !== null ? Boolean(confirmPayEnabled) : true,
        confirmPayDisabledTitle: confirmPayDisabledTitle || '',
        confirmPayDisabledMessage: confirmPayDisabledMessage || '',
        maintenanceMode: maintenanceMode !== null ? Boolean(maintenanceMode) : false,
        homeBannerEnabled: homeBannerStatus !== null ? Boolean(homeBannerStatus) : false,
        homeBannerTitle: homeBannerTitle || '',
        homeBannerText: homeBannerText || '',
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
    confirmPayEnabled: true, // true = payment/ordering allowed, false = disabled
    confirmPayDisabledTitle: '', // custom alert title from office controls
    confirmPayDisabledMessage: '', // custom text description from office controls
    maintenanceMode: false,  // true = app is under maintenance, false = app runs normally
    homeBannerEnabled: false, // true = show hanging banner on home page, false = hide
    homeBannerTitle: '',      // custom banner headline
    homeBannerText: '',       // custom banner message / details
    lastFetched: null,
    loading: false,
    error: null,
  },
  reducers: {
    setConfirmPayEnabled: (state, action) => {
      if (typeof action.payload === 'object' && action.payload !== null) {
        state.confirmPayEnabled = Boolean(action.payload.status);
        if (action.payload.title !== undefined) {
          state.confirmPayDisabledTitle = String(action.payload.title);
        }
        if (action.payload.description !== undefined) {
          state.confirmPayDisabledMessage = String(action.payload.description);
        }
      } else {
        state.confirmPayEnabled = Boolean(action.payload);
      }
    },
    setConfirmPayDisabledTitle: (state, action) => {
      state.confirmPayDisabledTitle = String(action.payload || '');
    },
    setConfirmPayDisabledMessage: (state, action) => {
      state.confirmPayDisabledMessage = String(action.payload || '');
    },
    setHomeBanner: (state, action) => {
      if (typeof action.payload === 'object' && action.payload !== null) {
        if (action.payload.status !== undefined) state.homeBannerEnabled = Boolean(action.payload.status);
        if (action.payload.title !== undefined) state.homeBannerTitle = String(action.payload.title);
        if (action.payload.text !== undefined) state.homeBannerText = String(action.payload.text);
      } else {
        state.homeBannerEnabled = Boolean(action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchControlsStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchControlsStatus.fulfilled, (state, action) => {
        state.confirmPayEnabled = Boolean(action.payload.confirmPayEnabled);
        if (action.payload.confirmPayDisabledTitle !== undefined) {
          state.confirmPayDisabledTitle = String(action.payload.confirmPayDisabledTitle || '');
        }
        if (action.payload.confirmPayDisabledMessage !== undefined) {
          state.confirmPayDisabledMessage = String(action.payload.confirmPayDisabledMessage || '');
        }
        state.maintenanceMode = Boolean(action.payload.maintenanceMode);
        state.homeBannerEnabled = Boolean(action.payload.homeBannerEnabled);
        if (action.payload.homeBannerTitle !== undefined) {
          state.homeBannerTitle = String(action.payload.homeBannerTitle || '');
        }
        if (action.payload.homeBannerText !== undefined) {
          state.homeBannerText = String(action.payload.homeBannerText || '');
        }
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

export const { setConfirmPayEnabled, setConfirmPayDisabledTitle, setConfirmPayDisabledMessage, setHomeBanner } = controlsSlice.actions;
export default controlsSlice.reducer;
