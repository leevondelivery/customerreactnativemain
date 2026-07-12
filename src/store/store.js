import { configureStore } from '@reduxjs/toolkit';
import restaurantsReducer from './restaurantsSlice';
import locationReducer from './locationSlice';

export const store = configureStore({
  reducer: {
    restaurants: restaurantsReducer,
    location: locationReducer,
  },
});
