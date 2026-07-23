const getApiUrl = () => {
  // For local web browser testing:
  // return 'http://localhost:5000';
  

  
  // Current production URL:
  return 'https://api.leevondelivery.in';
};

export const API_URL = getApiUrl();

export const CONTACT_INFO = {
  phone: '7207610235',
  displayPhone: '+91 7207610235',
  socials: {
    youtube: 'https://www.youtube.com/@LeevonDelivery',
    x: 'https://x.com/Leevondelivery',
    linkedin: 'https://www.linkedin.com/in/leevon-delivery-047511424',
    instagram: 'https://www.instagram.com/leevondelivery/',
    facebook: 'https://www.facebook.com/profile.php?id=61588710924852',
  },
};
