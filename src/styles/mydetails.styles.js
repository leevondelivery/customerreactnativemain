import { Platform, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)', // cream background
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 130, // padding to clear bottom tabbar
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    marginTop: Platform.OS === 'ios' ? 44 : 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholderRight: {
    width: 44,
  },
  detailsContainer: {
    backgroundColor: '#E6DFCE', // beige container
    borderRadius: 30,
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  detailText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  editText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  dobInputButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dobInputText: {
    fontSize: 15,
    color: '#000000',
  },
  dobInputTextPlaceholder: {
    fontSize: 15,
    color: '#8E8E93',
  },
  updatingIndicator: {
    marginVertical: 10,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6C6C6C',
    fontWeight: '500',
  },
  // Edit Profile Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#F9F8F3', // creamy soft off-white/beige
    borderRadius: 40,
    width: '90%',
    maxWidth: 340,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
    }),
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    gap: 6,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666666',
    paddingLeft: 4,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E6DFCE',
    outlineStyle: 'none',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    width: '100%',
  },
  modalButtonsContainer: {
    width: '100%',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  modalConfirmButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 14,
    width: '90%',
    maxWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
    }),
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    width: '90%',
    maxWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '700',
  },
  // Calendar styles
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E6DFCE',
    padding: 16,
    width: '100%',
    marginTop: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  calendarHeaderBtn: {
    padding: 6,
  },
  calendarSelectors: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  selectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFCE',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    width: 36,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  dayTextInactive: {
    color: '#C8C7CC',
  },
  activeDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C1C1E', // black circle matching screenshot
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    width: '70%',
    maxHeight: 250,
    borderWidth: 1,
    borderColor: '#E6DFCE',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
    }),
  },
  dropdownItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    alignItems: 'center',
    width: '100%',
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
    }),
  },
});
