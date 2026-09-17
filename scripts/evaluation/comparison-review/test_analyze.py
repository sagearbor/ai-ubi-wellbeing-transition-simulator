import unittest
from analyze import recipes, blend, metric, index_rows, percentile

class ComparisonTests(unittest.TestCase):
    def test_catalog_is_unique_and_convex(self):
        rows=list(recipes(9));self.assertEqual(len(rows),583)
        self.assertEqual(len({tuple(sorted(r['weights'].items())) for r in rows}),583)
        for r in rows:self.assertAlmostEqual(sum(r['weights'].values()),1)
        self.assertEqual(sum(r['kind']=='weighted-pair' for r in rows),72)
    def test_averages_predictions_not_errors(self):
        result=blend([[2.],[-2.]],{0:.5,1:.5})
        self.assertEqual(metric(result,[1.],[0])['mae'],0.)
    def test_uses_same_observation_mask(self):
        m=metric([3.,None,1.],[2.,None,2.],[0,2])
        self.assertEqual(m['n'],2);self.assertEqual(m['mae'],2);self.assertEqual(m['skill'],0)
    def test_keys_not_row_order_and_duplicates_fail(self):
        rows=[{'id':'B','year':2020,'ladder':2,'gdp':8},{'id':'A','year':2020,'ladder':1,'gdp':4}]
        self.assertEqual(index_rows(rows,[('A',2020),('B',2020)])[('A',2020)]['gdp'],4)
        with self.assertRaises(ValueError):index_rows(rows+rows,[('A',2020),('B',2020)])
        with self.assertRaises(ValueError):index_rows(rows,[('A',2020)])
    def test_percentile_interpolates(self):
        self.assertEqual(percentile([0,10],.25),2.5)

if __name__=='__main__':unittest.main()
