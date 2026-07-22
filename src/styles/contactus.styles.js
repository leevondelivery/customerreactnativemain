import { Platform, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F6', // cream background
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 130, // clear floating tabbar
    gap: 20,
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
    backgroundColor: '#F9F9F6', // matching page background color
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9F9F6', // matching page background color
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
  bannerCard: {
    backgroundColor: '#E6DFCE', // warm tan background matching section containers
    borderRadius: 30,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 8,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#000000', // black background
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  bannerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF', // white text
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    marginTop: 4,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#4A4A4A',
    lineHeight: 20,
    fontWeight: '500',
  },
  phoneSectionContainer: {
    backgroundColor: '#E6DFCE', // warm tan container background
    borderRadius: 30,
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  phoneItemCard: {
    backgroundColor: '#F9F9F6', // matching page background color
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  phoneIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#000000', // black background
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInfo: {
    flex: 1,
  },
  phoneLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    marginTop: 1,
  },
  phoneHours: {
    fontSize: 11,
    color: '#000000', // black text only
    fontWeight: '600',
    marginTop: 1,
  },
  callButton: {
    backgroundColor: '#2E2E2E', // light black background
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionContainer: {
    backgroundColor: '#E6DFCE',
    borderRadius: 30,
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    marginLeft: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  socialItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F6', // matching page background color
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  socialItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  socialItemIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialItemTextContainer: {
    flex: 1,
  },
  socialItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  socialItemHandle: {
    fontSize: 12,
    color: '#777777',
    fontWeight: '500',
    marginTop: 1,
  },
  visitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2E2E2E', // light black background
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  visitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF', // white text on light black background
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
