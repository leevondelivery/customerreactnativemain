import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 100,
    gap: 12,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    backgroundColor: 'rgb(247, 247, 235)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 36,
  },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#E8E2D4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 22,
  },
  orderButton: {
    marginTop: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 36,
    width: '100%',
    alignItems: 'center',
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // Notification Banner
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  notificationDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#D32F2F',
    flexShrink: 0,
    marginTop: 2,
  },
  notificationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 20,
  },

  // Main Card
  mainCard: {
    backgroundColor: '#EDE8DC',
    borderRadius: 26,
    padding: 16,
    gap: 12,
  },

  // Restaurant Name
  restaurantName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  restaurantDivider: {
    height: 1,
    backgroundColor: '#C8BFA8',
    marginVertical: 2,
  },

  // Section header label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 18,
    overflow: 'hidden',
  },

  // Order ID badge
  orderIdBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 13,
    alignSelf: 'flex-start',
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // Progress Bar
  progressSection: {
    gap: 6,
  },
  progressBarWrapper: {
    position: 'relative',
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: '#2E7D32',
  },
  progressBarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    zIndex: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  progressStagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  stageText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666666',
    flexShrink: 1,
    textAlign: 'center',
  },
  stageTextActive: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D32',
    flexShrink: 1,
    textAlign: 'center',
  },

  // Delivery Boy Card
  deliveryBoyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  deliveryBoyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryBoyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: '#F0EDE6',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
    overflow: 'hidden',
  },
  deliveryBoyName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  notAssignedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#AEAEB2',
    fontStyle: 'italic',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2E7D32',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  callButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Items Table
  itemsTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  tableHeaderTextLeft: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 2,
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F5F0',
  },
  tableCell: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  tableCellLeft: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 2,
    textAlign: 'left',
  },
  tableDivider: {
    height: 1,
    backgroundColor: '#E5E1D8',
    marginHorizontal: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555555',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555555',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E1D8',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  // Payment Card
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  paidBadge: {
    backgroundColor: '#2E7D32',
    borderRadius: 18,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  paidBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paymentIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
  },
  paymentIdValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888888',
  },

  // OTP Box
  otpBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignSelf: 'center',
    minWidth: 170,
    alignItems: 'center',
  },
  otpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 3,
  },
});
