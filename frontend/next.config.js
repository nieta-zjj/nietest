/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'oss.talesofai.cn',
                pathname: '**',
            },
        ],
    },
};

module.exports = nextConfig;
