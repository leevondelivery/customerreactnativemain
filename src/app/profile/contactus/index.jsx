import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useTabBar } from '../../_layout';
import { CONTACT_INFO } from '../../../config';
import { styles } from '../../../styles/contactus.styles';

export default function ContactUsScreen() {
  const router = useRouter();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastOffsetY = useRef(0);

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastOffsetY.current ? 'down' : 'up';

    if (Math.abs(currentOffset - lastOffsetY.current) > 15) {
      if (direction === 'down' && currentOffset > 60) {
        hideTabBar();
      } else if (direction === 'up') {
        showTabBar();
      }
      lastOffsetY.current = currentOffset;
    }
  };

  const socialPlatforms = [
    {
      name: 'YouTube',
      handle: '@LeevonDelivery',
      url: CONTACT_INFO.socials.youtube,
      icon: <FontAwesome name="youtube-play" size={22} color="#FF0000" />,
      bg: '#FFEBEE',
    },
    {
      name: 'X (Twitter)',
      handle: '@Leevondelivery',
      url: CONTACT_INFO.socials.x,
      icon: <FontAwesome name="twitter" size={20} color="#000000" />,
      bg: '#F5F5F5',
    },
    {
      name: 'LinkedIn',
      handle: 'Leevon Delivery',
      url: CONTACT_INFO.socials.linkedin,
      icon: <FontAwesome name="linkedin-square" size={20} color="#0A66C2" />,
      bg: '#E8F4F9',
    },
    {
      name: 'Instagram',
      handle: '@leevondelivery',
      url: CONTACT_INFO.socials.instagram,
      icon: <FontAwesome name="instagram" size={22} color="#E4405F" />,
      bg: '#FCE4EC',
    },
    {
      name: 'Facebook',
      handle: 'Leevon Delivery',
      url: CONTACT_INFO.socials.facebook,
      icon: <FontAwesome name="facebook-square" size={22} color="#1877F2" />,
      bg: '#E8EAF6',
    },
  ];

  const handleCall = () => {
    Linking.openURL(`tel:${CONTACT_INFO.phone}`).catch(err =>
      console.error('Failed to make phone call:', err)
    );
  };

  const handleOpenSocial = (url) => {
    Linking.openURL(url).catch(err =>
      console.error('Failed to open social URL:', err)
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, styles.shadow]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Feather name="chevron-left" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={[styles.headerTitleCard, styles.shadow]}>
            <Feather name="mail" size={18} color="#000000" />
            <Text style={styles.headerTitleText}>Contact Us</Text>
          </View>

          <View style={styles.placeholderRight} />
        </View>

        {/* Hero Welcome Card */}
        <View style={[styles.bannerCard, styles.shadow]}>
          <View style={styles.bannerBadge}>
            <Feather name="headphones" size={14} color="#FFFFFF" />
            <Text style={styles.bannerBadgeText}>HELP & SUPPORT</Text>
          </View>
          <Text style={styles.bannerTitle}>We're Here For You!</Text>
          <Text style={styles.bannerSubtitle}>
            Have questions about an order, feedback, or business inquiries? Connect with us directly via phone or follow our official social channels.
          </Text>
        </View>

        {/* Customer Support Phone Line */}
        <View style={[styles.phoneSectionContainer, styles.shadow]}>
          <View style={styles.phoneItemCard}>
            <View style={styles.phoneLeft}>
              <View style={styles.phoneIconCircle}>
                <Feather name="phone-call" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.phoneInfo}>
                <Text style={styles.phoneLabel}>Customer Support</Text>
                <Text style={styles.phoneNumber}>{CONTACT_INFO.displayPhone}</Text>
                <Text style={styles.phoneHours}>Available 24/7 for delivery support</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.callButton}
              activeOpacity={0.85}
              onPress={handleCall}
            >
              <Feather name="phone" size={14} color="#FFFFFF" />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Official Social Media Section */}
        <View style={[styles.sectionContainer, styles.shadow]}>
          <Text style={styles.sectionHeaderTitle}>Follow & Connect With Us</Text>

          {socialPlatforms.map((platform, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.socialItemCard, styles.shadow]}
              activeOpacity={0.85}
              onPress={() => handleOpenSocial(platform.url)}
            >
              <View style={styles.socialItemLeft}>
                <View style={[styles.socialItemIconCircle, { backgroundColor: platform.bg }]}>
                  {platform.icon}
                </View>
                <View style={styles.socialItemTextContainer}>
                  <Text style={styles.socialItemName}>{platform.name}</Text>
                  <Text style={styles.socialItemHandle}>{platform.handle}</Text>
                </View>
              </View>

              <View style={styles.visitBtn}>
                <Text style={styles.visitBtnText}>Visit</Text>
                <Feather name="external-link" size={14} color="#F9F9F6" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
