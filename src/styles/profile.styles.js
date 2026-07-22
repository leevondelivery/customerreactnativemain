import { Platform, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)', // off-white cream background
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 130, // extra padding so content isn't cut off by floating tab bar
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
    width: 44, // empty placeholder to balance out backButton and center title card
  },
  userInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 20,
    gap: 18,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#2E2E2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  coinsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C2932E', // golden bronze warm color from screenshot
    borderRadius: 25,
    padding: 20,
    gap: 16,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    overflow: 'hidden', // hides shine highlight overflow
  },
  coinsCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsContent: {
    justifyContent: 'center',
  },
  coinsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.9,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  coinsValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shineOverlay: {
    position: 'absolute',
    top: -60,
    bottom: -60,
    width: 95, // wide sheen bar matching screenshot
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // highly transparent/faint white reflection
  },
  buttonsContainer: {
    backgroundColor: '#E6DFCE', // soft tan container enclosing buttons
    borderRadius: 30,
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  buttonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F6', // matching page background color
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  buttonPillLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D32F2F', // premium deep red
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  buttonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  buttonTextLogout: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteSection: {
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  deleteLabelText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FFEBEB',
    borderRadius: 20,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D32F2F',
  },
  // Custom Logout Confirmation Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#F9F8F3', // creamy soft off-white/beige
    borderRadius: 40,
    width: '85%',
    maxWidth: 320,
    paddingTop: 40,
    paddingBottom: 32,
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
  modalIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#D32F2F', // premium deep red
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#D32F2F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: '#D32F2F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
    }),
  },
  modalText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 28,
  },
  modalButtonsContainer: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  modalConfirmButton: {
    backgroundColor: '#D32F2F', // matching premium deep red from logout button
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
  // Social Media & Contact Section Styles
  socialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 14,
  },
  socialHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 0.3,
  },
  socialIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  socialIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  contactModalCard: {
    backgroundColor: '#F9F8F3',
    borderRadius: 32,
    width: '90%',
    maxWidth: 380,
    maxHeight: '85%',
    padding: 24,
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
  contactModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 18,
  },
  contactModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  contactModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBEBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactPhoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  contactPhoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactPhoneIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactPhoneTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  contactPhoneNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginTop: 2,
  },
  contactCallBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactCallBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  contactSectionSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555555',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  socialGrid: {
    width: '100%',
    gap: 10,
  },
  socialGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  socialItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  socialItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
});

