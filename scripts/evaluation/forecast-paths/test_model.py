import unittest,math
from model import f_income,fit,forecast
class ModelTests(unittest.TestCase):
 def test_income_saturation_has_smaller_rich_response(self):
  k=10000
  poor=f_income(1100,k,True)-f_income(1000,k,True)
  rich=f_income(110000,k,True)-f_income(100000,k,True)
  self.assertGreater(poor,rich);self.assertGreater(rich,0)
  self.assertAlmostEqual(f_income(1100,k,False)-f_income(1000,k,False),f_income(110000,k,False)-f_income(100000,k,False))
 def test_future_training_rejected(self):
  with self.assertRaises(ValueError):fit({'gdp':{'A':{'2019':100}},'ladder':{},'countries':[]},{},2018,{'health':True,'saturation':False})
 def test_health_off_and_zero_growth_give_persistence(self):
  m={'cutoff':2018,'covariates':{'A':{'gdpSlope':0,'healthSlope':1,'healthOrigin':70}},'k':10000,'variant':{'saturation':True},'betaGdp':1,'scaleGdp':1,'betaHealth':0,'scaleHealth':1}
  p=forecast({'id':'A','name':'A','gdp':1000,'ladder':5},m,7,2025)
  self.assertEqual(p['ladder'],5);self.assertEqual(p['gdp'],1000);self.assertEqual(p['year'],2032)
 def test_future_origin_must_follow_fit(self):
  with self.assertRaises(ValueError):forecast({}, {'cutoff':2018},1,2017)
if __name__=='__main__':unittest.main()
