"""Read-only integrity checks; never refit or rerun the scored experiment."""
import hashlib,json,math,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'data/evaluation/diagnostic-health-income-2018-v1'
def read(name):return json.loads((OUT/name).read_text())
class ArtifactTests(unittest.TestCase):
 def test_frozen_inputs_and_predictions_unchanged(self):
  protocol=read('protocol.json');manifest=read('freeze-manifest.json')
  for p,h in {**protocol['sourceHashes'],**manifest['sourceHashes']}.items():
   self.assertEqual(hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),h,p)
  for p,key in [('protocol.json','protocolSha256'),('predictions.json','predictionSha256')]:
   self.assertEqual(hashlib.sha256((OUT/p).read_bytes()).hexdigest(),manifest[key])
 def test_plot_preserves_frozen_diagnostic_average(self):
  frozen={(r['id'],r['year']):r for r in read('predictions.json')['diagnostic_mean']}
  for c in read('paths.json')['countries']:
   for target in ['ladder','gdp']:
    for year,value in c['historical']['diagnostic_mean'][target][1:]:
     self.assertAlmostEqual(value,frozen[c['id'],year][target],places=7)
 def test_projection_coverage_and_actual_origin(self):
  paths=read('paths.json');eligible=0
  for c in paths['countries']:
   has_origin=all(c['observed'][t][-1][0]==2025 and c['observed'][t][-1][1] is not None for t in ['ladder','gdp'])
   self.assertEqual(c['futureEligible'],has_origin)
   self.assertEqual(bool(c['future']),has_origin)
   eligible+=has_origin
   for model in c['future'].values():
    for target,points in model.items():
     self.assertEqual(points[0],c['observed'][target][-1])
     self.assertEqual([p[0] for p in points],list(range(2025,2033)))
     self.assertTrue(all(math.isfinite(p[1]) for p in points))
  self.assertEqual(eligible,94)
 def test_published_scores_keep_target_masks_and_receipt(self):
  result=read('scores.json')
  self.assertEqual(result['receipt'],read('score-receipt.json'))
  for scores in result['scores'].values():
   for target,n in [('ladder',681),('gdp',691)]:
    self.assertEqual(scores[target]['pooled']['n'],n)
    self.assertEqual(scores[target]['endpoint']['n'],97)
 def test_offset_adapter_reconstruction(self):
  self.assertEqual(read('forward-offset.json')['reconstruction'],{'maxLadder':0,'maxGdp':0})
if __name__=='__main__':unittest.main()
