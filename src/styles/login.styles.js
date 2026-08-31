import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgb(247, 247, 235)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6C6C6C',
    fontWeight: '500',
  },
  leftBg: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)', // Off-white cream
  },
  rightBg: {
    flex: 1,
    backgroundColor: '#DCD3C5', // Tan beige
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16, // Vertical spacing between main elements
  },
  brandCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 28,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoImage: {
    width: 70,
    height: 70,
    marginBottom: 2,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 1.5,
    marginTop: 2,
    ...Platform.select({
      ios: {
        fontFamily: 'Georgia',
      },
      android: {
        fontFamily: 'serif',
      },
      web: {
        fontFamily: "'Lucida Bright', 'Lucida Fax', 'Merriweather', 'Lora', Georgia, serif",
      },
    }),
  },
  formContainer: {
    width: '85%',
    maxWidth: 380,
    gap: 12, // Spacing between inputs
  },
  inputPill: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 18,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#000000',
    outlineStyle: 'none',
  },
  buttonPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 50,
    paddingVertical: 14,
    borderRadius: 30,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000000',
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 24,
    width: '85%',
    maxWidth: 380,
    gap: 16,
  },
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
  },
  welcomeLabel: {
    fontWeight: 'bold',
    color: '#666666',
    fontSize: 14,
  },
  welcomeValue: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
    }),
  },
  
  // Custom Error Modal Styles
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
    backgroundColor: '#F34D4D', // bright red/coral
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#F34D4D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: '#F34D4D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
    }),
  },
  modalText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 32,
  },
  modalButton: {
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
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // Support Modal Styles
  supportModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    width: '88%',
    maxWidth: 360,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
    }),
  },
  supportHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  supportTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  supportTitleText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#000000',
  },
  supportCloseIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F2EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportSubText: {
    fontSize: 13,
    color: '#6C6C6C',
    lineHeight: 18,
    marginBottom: 16,
  },
  supportOptionsContainer: {
    gap: 12,
  },
  supportOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F8F5',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEBE4',
  },
  supportOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  supportIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportOptionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7E7C77',
    letterSpacing: 0.5,
  },
  supportOptionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    marginTop: 2,
  },
  supportCallButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  supportCallButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  supportEmailButton: {
    backgroundColor: '#1877F2',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  supportEmailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  supportOkButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
    }),
  },
  supportOkButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
