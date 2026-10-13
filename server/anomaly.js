// Unsupervised k-nearest-neighbor novelty detection, fitted only to actual
// allowed application events. No synthetic training rows or claimed accuracy.
const vector = (event) => [Math.log1p(event.requests ?? 0), Math.log1p(event.payload ?? 0), event.failures ?? 0]
const distance = (a, b) => Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0))
const nearest = (point, baseline, k = 5) => baseline.map((row) => distance(point, row)).sort((a, b) => a - b).slice(0, Math.min(k, baseline.length)).reduce((sum, value) => sum + value, 0) / Math.min(k, baseline.length)

export function detectAnomaly(event, trainingRows) {
  const rows = trainingRows.filter((row) => row.decision === 'Allowed' && row.source === 'Application' && !['Login failed', 'Access denied'].includes(row.operation)).slice(0, 200)
  if (rows.length < 20) return { method: 'kNN novelty', status: 'Collecting baseline', samples: rows.length, required: 20, anomalous: false }
  const raw = rows.map(vector)
  const means = raw[0].map((_, i) => raw.reduce((sum, row) => sum + row[i], 0) / raw.length)
  const scales = means.map((mean, i) => Math.max(0.1, Math.sqrt(raw.reduce((sum, row) => sum + (row[i] - mean) ** 2, 0) / raw.length)))
  const normalized = raw.map((row) => row.map((value, i) => (value - means[i]) / scales[i]))
  const calibration = normalized.map((point, index) => nearest(point, normalized.filter((_, i) => i !== index))).sort((a, b) => a - b)
  const threshold = Math.max(1, calibration[Math.floor(0.95 * (calibration.length - 1))] * 1.5)
  const novelty = nearest(vector(event).map((value, i) => (value - means[i]) / scales[i]), normalized)
  const observed=vector(event).map((value,i)=>(value-means[i])/scales[i])
  const explanations=['Request frequency','Payload size','Failed attempts'].map((feature,i)=>({feature,deviation:Number(Math.abs(observed[i]).toFixed(2))})).sort((a,b)=>b.deviation-a.deviation)
  return { method: 'kNN novelty', status: 'Ready', samples: rows.length, required: 20, novelty: Number(novelty.toFixed(3)), threshold: Number(threshold.toFixed(3)), anomalous: novelty > threshold, explanations }
}
