/** This module accepts ONLY physically partitioned training data. No engine/default imports. */
import { fitWellbeingAnchor } from '../countries/anchorFit';
import { validateBackground, type Train } from './partition';
export function fit(train: Train) {
    if (JSON.stringify(train.years) !== '[2015,2016,2017,2018]')
        throw Error('Training years drift');
    train.countries.forEach(validateBackground);
    for (const panel of [train.ladder, train.gdp])
        for (const [id, rows] of Object.entries(panel))
            for (const [year, value] of Object.entries(rows)) {
                if (!train.years.includes(Number(year)) || !Number.isFinite(value) || !train.countries.some(c => c.id === id))
                    throw Error('Unexpected training observation');
                if (panel === train.gdp ? value <= 0 : value < 0 || value > 10)
                    throw Error('Invalid training value');
            }
    const result = fitWellbeingAnchor(train.countries, train.ladder, train.gdp, train.years);
    const { intercept, lnGdp, governance, n, rSquared, rmse, years } = result;
    return { coefficients: { intercept, lnGdp, governance }, training: {
            n, rSquared, rmseIndexPoints: rmse, years
        }, uncertainty: 'No forecast interval estimated; repeated country rows invalidate naive independent-row uncertainty.' };
}
