let instance = undefined

export default class I18n {
  static initialize = (i18n) => {
    instance = i18n
    console.log(`Coinray I18n initialized`)
  }

  static t = (key) => {
    if (instance) {
      return instance.t(`coinray:${key}`)
    } else {
      return `i18n uninitialized. Set the Coinray.I18n.instance. Key: ${key}`
    }
  }
}
