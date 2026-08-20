// ===== Visitor counter (CounterAPI, sessionStorage dedupe) =====
;(function visitorCounter() {
  const NAMESPACE = 'unfence-givat-ram'
  const KEY = 'visits'
  const el = document.getElementById('visitorCount')
  if (!el) return

  const alreadyCounted = sessionStorage.getItem('unfence-visited')
  const endpoint = alreadyCounted
    ? `https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}/`
    : `https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}/up`

  fetch(endpoint)
    .then((r) => r.json())
    .then((data) => {
      const count = data?.count ?? data?.data?.up_count
      if (typeof count === 'number') {
        el.textContent = count.toLocaleString('he-IL')
        sessionStorage.setItem('unfence-visited', '1')
      }
    })
    .catch(() => {})
})()

// ===== Petition: stats (count + recent signers) =====
async function loadPetitionStats() {
  try {
    const res = await fetch('/.netlify/functions/petition-stats')
    const data = await res.json()

    const countEl = document.getElementById('petitionCount')
    if (countEl && typeof data.count === 'number') {
      countEl.textContent = data.count.toLocaleString('he-IL')
    }

    const listEl = document.getElementById('recentSigners')
    if (listEl && Array.isArray(data.recent)) {
      listEl.innerHTML = data.recent
        .map((s) => {
          const name = escapeHtml(s.name)
          const hood = s.neighborhood ? ` · ${escapeHtml(s.neighborhood)}` : ''
          return `<li>${name}${hood}</li>`
        })
        .join('')
    }
  } catch {
    // fail silently — counter just stays at placeholder
  }
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

loadPetitionStats()

// ===== Petition: submit =====
const petitionForm = document.getElementById('petitionForm')
if (petitionForm) {
  petitionForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const errorEl = document.getElementById('petitionError')
    errorEl.hidden = true

    const honeypot = petitionForm.querySelector('[name="bot-field"]')
    if (honeypot && honeypot.value) return // bot

    const submitBtn = petitionForm.querySelector('button[type="submit"]')
    submitBtn.disabled = true
    submitBtn.textContent = 'שולח...'

    const payload = {
      name: petitionForm.querySelector('#p-name').value,
      email: petitionForm.querySelector('#p-email').value,
      neighborhood: petitionForm.querySelector('#p-neighborhood').value,
      hideName: petitionForm.querySelector('#p-hide-name').checked,
    }

    try {
      const res = await fetch('/.netlify/functions/petition-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        errorEl.textContent = data.error || 'שליחה נכשלה, נסו שוב'
        errorEl.hidden = false
        submitBtn.disabled = false
        submitBtn.textContent = 'חותם/ת על העצומה'
        return
      }

      petitionForm.hidden = true
      document.getElementById('petitionThanks').hidden = false
      loadPetitionStats()
    } catch {
      errorEl.textContent = 'שגיאת תקשורת — נסו שוב בעוד רגע'
      errorEl.hidden = false
      submitBtn.disabled = false
      submitBtn.textContent = 'חותם/ת על העצומה'
    }
  })
}
