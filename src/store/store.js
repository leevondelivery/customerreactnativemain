import { configureStore } from '@reduxjs/toolkit';
import restaurantsReducer from './restaurantsSlice';
import locationReducer from './locationSlice';
import controlsReducer from './controlsSlice';

export const store = configureStore({
  reducer: {
    restaurants: restaurantsReducer,
    location: locationReducer,
    controls: controlsReducer,
  },
});
