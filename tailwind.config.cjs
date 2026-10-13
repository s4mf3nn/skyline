/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ground: "#0C0C0C",
        ink: "#F4F1EA",
      },
      fontFamily: {
        archivo: ["Archivo"],
      },
    },
  },
  plugins: [],
};
