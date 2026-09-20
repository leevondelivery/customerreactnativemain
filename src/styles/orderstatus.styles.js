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
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 19,
    color: '#8E8E93',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 24,
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
    fontSize: 17.5,
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
    fontSize: 15,
  },

  // Notification Banner
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  notificationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D32F2F',
    flexShrink: 0,
    marginTop: 3,
  },
  notificationText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 22,
  },

  // Main Card
  mainCard: {
    backgroundColor: 'rgb(224, 214, 188)', // matching navbar background color
    borderRadius: 26,
    padding: 18,
    gap: 14,
  },

  // Restaurant Name
  restaurantName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  restaurantDivider: {
    height: 1,
    backgroundColor: '#C8BFA8',
    marginVertical: 4,
  },

  // Section header label
  sectionLabel: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Order ID badge
  orderIdBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 15,
    alignSelf: 'flex-start',
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // Progress Bar
  progressSection: {
    gap: 8,
  },
  progressBarWrapper: {
    position: 'relative',
    height: 44,
    borderRadius: 22,
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
    borderRadius: 22,
    backgroundColor: '#2E7D32',
  },
  progressBarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    zIndex: 2,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  progressStagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  stageText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#666666',
    flexShrink: 1,
    textAlign: 'center',
  },
  stageTextActive: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2E7D32',
    flexShrink: 1,
    textAlign: 'center',
  },

  // Delivery Boy Card
  deliveryBoyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  deliveryBoyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliveryBoyLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: '#F0EDE6',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  deliveryBoyName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  notAssignedText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#AEAEB2',
    fontStyle: 'italic',
  },
  // Delivery Address Card
  deliveryAddressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  addressIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0EDE6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressTagBadge: {
    backgroundColor: '#2E7D32',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  addressTagText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E7D32',
    borderRadius: 25,
    paddingVertical: 14,
    width: '100%',
    marginTop: 4,
  },
  callButtonText: {
    fontSize: 17.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Items Table
  itemsTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  billSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F5F0',
  },
  tableColItems: {
    flex: 2.8,
    paddingRight: 6,
  },
  tableColQty: {
    flex: 1.4,
  },
  tableColCost: {
    flex: 1.8,
    alignItems: 'flex-end',
  },
  tableHeaderText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  itemText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  qtyText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'left',
    paddingLeft: 12,
  },
  costText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'right',
  },
  tableDivider: {
    height: 1,
    backgroundColor: '#E5E1D8',
    marginHorizontal: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#555555',
    flex: 3,
    textAlign: 'left',
  },
  summaryValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1.8,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E1D8',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    flex: 3,
    textAlign: 'left',
  },
  totalValue: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#1A1A1A',
    flex: 1.8,
    textAlign: 'right',
  },

  // Payment Card
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  paidBadge: {
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 16,
  },
  paidBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paymentIdText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
  },
  paymentIdValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888888',
  },

  // OTP Box
  otpBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignSelf: 'center',
    minWidth: 190,
    alignItems: 'center',
  },
  otpText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 3,
  },

  // Review Button
  reviewButton: {
    marginTop: 14,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    paddingVertical: 15,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16.5,
  },
});
