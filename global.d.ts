// Type declarations for non-code imports.
// Fixes TS error: "Cannot find module or type declarations for side-effect import of '../styles/globals.css'"

declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.less';

// Image / asset imports (in case needed elsewhere)
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';
