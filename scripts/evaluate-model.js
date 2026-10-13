import {detectAnomaly} from '../server/anomaly.js'
// Explicitly synthetic development evaluation; never uploaded to the database.
const training=Array.from({length:40},(_,i)=>({source:'Application',operation:'Test fixture',decision:'Allowed',requests:10+i%5,payload:0.5+i%4/10,failures:0}))
const trials=[{label:false,requests:11,payload:0.6,failures:0},{label:false,requests:13,payload:0.7,failures:0},{label:true,requests:1000,payload:4000,failures:0},{label:true,requests:2000,payload:10000,failures:5}]
const results=trials.map(event=>({expected:event.label,...detectAnomaly(event,training)}))
const confusion={truePositive:0,trueNegative:0,falsePositive:0,falseNegative:0}
for(const result of results)confusion[result.expected?(result.anomalous?'truePositive':'falseNegative'):(result.anomalous?'falsePositive':'trueNegative')]++
console.log(JSON.stringify({dataset:'Synthetic development scenarios only; not production accuracy',trainingRecords:training.length,heldOutRecords:trials.length,confusion,results},null,2))
