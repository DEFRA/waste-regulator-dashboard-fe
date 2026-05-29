import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  Header,
  Radios,
  SkipLink
} from 'govuk-frontend'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Header)
createAll(Radios)
createAll(SkipLink)

document.querySelectorAll('a[href="#todo"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault()
    window.alert('Not implemented yet.')
  })
})
