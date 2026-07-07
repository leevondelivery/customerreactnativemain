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
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#000000', // thick black border matching screenshot
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 16,
  },
  experienceBox: {
    backgroundColor: 'rgb(247, 247, 235)', // theme background color
    borderWidth: 1,
    borderColor: '#E6DFCE',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  experienceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewCommentText: {
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#333333',
    marginTop: 8,
  },
  separator: {
    height: 1,
    borderStyle: 'dashed', // dashed border matching screenshot
    borderWidth: 0.5,
    borderColor: '#C8C7CC',
    marginVertical: 14,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#333333',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFCE',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '700',
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
