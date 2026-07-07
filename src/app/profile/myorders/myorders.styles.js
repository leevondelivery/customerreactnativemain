import { Platform, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)', // half-white / cream background
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 130, // padding to clear bottom tabbar
    gap: 16,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 12,
  },
  orderCard: {
    backgroundColor: '#E5DEC9', // soft tan/beige matching navbar background
    borderRadius: 25,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    flex: 1,
    marginRight: 10,
  },
  grandTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#C2932E', // gold matching coins banner accent
  },
  orderIdText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666666',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  itemName: {
    fontSize: 15,
    color: '#333333',
    flex: 1,
    fontWeight: '600',
  },
  itemQty: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    width: 40,
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '700',
    width: 70,
    textAlign: 'right',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAFCEE', // soft green background for success
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D', // dark green status color
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
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
