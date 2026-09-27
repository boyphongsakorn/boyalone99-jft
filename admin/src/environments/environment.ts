export const environment = {
  production: false,
  // Local admin talks to local backend (docker-compose maps 3000)
  apiUrl: 'http://192.168.31.215:8900',
  discordClientId: '1543216115327442946',
  twitchClientId: 'rwqzl1va975166m616kqoufi7pr2xh',
  youtubeClientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID',
} as const;
