function KindError(kind, message) {
  var err = new Error(message)

  err.kind = kind

  return err
}

module.exports = KindError
