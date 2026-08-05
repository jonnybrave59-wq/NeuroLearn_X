/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#071b34",
          900: "#0b2442",
          800: "#12365d",
          700: "#194b78"
        },
        cyanx: {
          600: "#079bb0",
          500: "#0bb7c9",
          400: "#39d0dc",
          100: "#dff9fb"
        }
      },
      boxShadow: {
        soft: "0 14px 36px rgba(7, 27, 52, 0.08)"
      }
    }
  },
  plugins: []
};

