// Configuration is shared with the explicit ESM file.
module.exports = async () => (await import('./vite.config.mjs')).default
