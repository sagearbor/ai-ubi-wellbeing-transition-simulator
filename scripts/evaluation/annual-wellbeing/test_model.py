import copy
import unittest
import numpy as np
from model import FEATURES, METHODS, cohort, fit, generate, metrics, predict


def fixture():
    rows=[]
    for i,c in enumerate(('AAA','BBB','CCC','DDD')):
        for year in range(2005,2021):
            t=year-2005
            rows.append({'id':c,'name':c,'year':year,'y':4+i*.4+.02*t+.09*np.sin(t+i),
                         'x':dict(zip(FEATURES,[8+i*.3+.04*t,62+i+.1*t+.05*np.sin(t),5+i-.03*t]))})
    return rows


class AnnualWellbeingTests(unittest.TestCase):
    def test_future_targets_cannot_change_earlier_forecasts_or_own_prediction(self):
        data=fixture(); before,_=generate(data)
        altered=copy.deepcopy(data)
        for r in altered:
            if r['year']>=2018: r['y'] += .8
        after,_=generate(altered)
        a={(r['id'],r['year'],r['mode']):r for r in after}
        for r in before:
            if r['year']<=2018:
                self.assertEqual(r['predictions'],a[(r['id'],r['year'],r['mode'])]['predictions'])

    def test_rolling_does_not_consult_target_year_drivers(self):
        data=fixture(); before,_=generate(data)
        altered=copy.deepcopy(data)
        for r in altered:
            if r['year']>=2018: r['x']={k:v+25 for k,v in r['x'].items()}
        after,_=generate(altered)
        a={(r['id'],r['year'],r['mode']):r for r in after}
        for r in before:
            if r['year']==2018 and r['mode']=='rolling':
                self.assertEqual(r['predictions'],a[(r['id'],r['year'],r['mode'])]['predictions'])
        self.assertTrue(any(r['predictions'] != a[(r['id'],r['year'],r['mode'])]['predictions'] for r in before if r['year']==2018 and r['mode']=='conditional'))

    def test_counts_masks_missing_and_time_constraints(self):
        data=fixture(); rows,eligible=generate(data)
        self.assertEqual(len(rows),4*4*2)
        self.assertEqual(len(eligible),4)
        for r in rows:
            self.assertEqual(set(r['predictions']),set(METHODS))
            self.assertEqual(r['origin'],r['year']-1)
            self.assertLessEqual(r['fitCutoff'],r['origin'])
            if r['mode']=='rolling': self.assertLessEqual(r['featureMaxYear'],r['origin'])
        for r in data:
            if r['id']=='AAA' and r['year']==2018: r['x']['life_expectancy']=None
        rows,_=generate(data)
        self.assertEqual(len(rows),32-5)
        self.assertTrue(any(r['id']=='AAA' and r['year']==2018 and r['mode']=='rolling' for r in rows))
        self.assertFalse(any(r['id']=='AAA' and r['year'] in (2019,2020) for r in rows))

    def test_same_origin_change_error_equals_level_error(self):
        rows,_=generate(fixture())
        for m in METHODS:
            result=metrics(rows,m)
            self.assertAlmostEqual(result['levelMAE'],result['changeMAE'],12)
        p=metrics(rows,'persistence')
        self.assertEqual(p['directionCoverageOnMoves'],0)
        self.assertEqual(p['absoluteErrorTiesVsPersistence'],len(rows))

    def test_country_offset_is_not_fitted_from_target(self):
        data=fixture(); changed=copy.deepcopy(data)
        for r in changed:
            if r['year']>2016: r['y']=10
        a,b=fit(data,2016,cohort(data)),fit(changed,2016,cohort(data))
        self.assertEqual(a['offsets'],b['offsets'])
        np.testing.assert_equal(a['level_b'],b['level_b'])

    def test_cohort_cannot_depend_on_test_years(self):
        data=fixture()
        data.extend({'id':'NEW','name':'new','year':y,'y':5,'x':dict(zip(FEATURES,[9,70,6]))} for y in range(2017,2021))
        self.assertNotIn('NEW',cohort(data))
        self.assertFalse(any(r['id']=='NEW' for r in generate(data)[0]))

if __name__=='__main__': unittest.main()
