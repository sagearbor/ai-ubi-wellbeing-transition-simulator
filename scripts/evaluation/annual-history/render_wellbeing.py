"""Render saved annual studies. No fit, scorer invocation, or parameter selection run.

The emphasized candidate is the minimum already-published pooled candidate MAE;
that retrospective display choice is explicit, not an independent confirmation.
"""
import hashlib
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.ticker import MaxNLocator
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/evaluation'
WPATH = DATA / 'annual-wellbeing-20260917/paths.json'
OPATH = DATA / 'annual-objective-20260917/metrics.json'
W = json.loads(WPATH.read_text())
O = json.loads(OPATH.read_text())
OUT = ROOT / 'docs/design/reviews/figures/annual-history-20260917'
OUT.mkdir(parents=True, exist_ok=True)
INK, MUTED, GOOD, BAD, BLUE = '#16232f', '#5c6878', '#12804f', '#bb3548', '#0072b2'
LABELS = {'change_ridge':'Annual-change model', 'country_offset':'Country + annual drivers',
 'residual_carry':'Country + recent residual', 'shrinkage_change':'Half model / half last value',
 'damped_trend':'Half last annual change', 'persistence':'Last observed value'}
COLORS = {'change_ridge':'#dd8e11', 'country_offset':'#9763bf', 'residual_carry':'#409d94',
 'shrinkage_change':BLUE, 'damped_trend':'#a0876d', 'persistence':'#8b959e'}
CANDIDATES = [m['id'] for m in W['methods'] if m['kind']=='candidate']
ORDER = ['country_offset','residual_carry','change_ridge','damped_trend','persistence','shrinkage_change']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':12,'text.color':INK,
 'axes.labelcolor':INK,'xtick.color':MUTED,'ytick.color':INK,'axes.edgecolor':'#cfd5dd',
 'figure.facecolor':'white','axes.facecolor':'white','savefig.facecolor':'white',
 'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,
 'axes.titleweight':'bold','grid.color':'#e8edf2'})


def save(fig, name):
    fig.savefig(OUT/(name+'.png'),dpi=155)
    plt.close(fig)


def skill_label(value):
    return f'{abs(value):.1f}% '+('less error' if value>0 else 'more error' if value<0 else 'same error')


def continuous(ax, pairs, **kwargs):
    """Missing years are NaN, so plots never bridge missing observations."""
    pts=dict(pairs)
    if not pts:
        return
    years=list(range(min(pts),max(pts)+1))
    ax.plot(years,[pts.get(y,np.nan) for y in years],**kwargs)


def wellbeing_country(c, mode):
    pool=W['metrics'][mode]['pooled']
    best=min(CANDIDATES,key=lambda m:pool[m]['levelMAE'])
    stat=W['metrics'][mode]['byCountry'][c['id']][best]
    skill=stat['percentMAEReductionVsPersistence'];good=skill>0
    rows=[r for r in c['rows'] if r['mode']==mode]
    years=[r['year'] for r in rows]
    last=max(W['metrics'][mode]['years']);first=min(W['metrics'][mode]['years'])
    fig,axs=plt.subplots(2,1,figsize=(11.6,10.8),gridspec_kw={'height_ratios':[1.3,1]})
    fig.subplots_adjust(left=.10,right=.965,top=.695,bottom=.16,hspace=.47)
    fig.text(.045,.961,f"{'GOOD' if good else 'BAD'} — {c['name']} · Annual wellbeing",fontsize=22,weight='bold',color=GOOD if good else BAD)
    fig.text(.045,.918,skill_label(skill)+' than repeating last year',fontsize=20,weight='bold',color=GOOD if good else BAD)
    mode_text='ONE-YEAR FORECAST · updates from prior-year information' if mode=='rolling' else 'CONDITIONAL REPLAY · uses actual target-year economic and health inputs'
    fig.text(.045,.876,mode_text,fontsize=11.5,weight='bold')
    fig.text(.045,.846,f"Mean absolute error: selected model {stat['levelMAE']:.3f}; last value {stat['persistenceMAE']:.3f} ladder points.",fontsize=11.5)
    fig.text(.045,.817,f"{stat['n']} scored years ({min(years)}–{max(years)}); only years with all required data enter the score.",fontsize=10.3,color=MUTED)
    handles=[Line2D([],[],color=INK,lw=2.7,label='Observed annual survey')]
    for method in ['persistence',best]+[m for m in ORDER if m not in ('persistence',best)]:
        handles.append(Line2D([],[],color=BLUE if method==best else COLORS[method],lw=2.8 if method==best else 1.3,ls='--' if method=='persistence' else '-',label=LABELS[method]+(' · selected' if method==best else '')))
    fig.legend(handles=handles,ncol=3,loc='upper left',bbox_to_anchor=(.045,.795),frameon=False,fontsize=9.5,columnspacing=1.2,handlelength=2)
    observed=[p for p in c['observed'] if p[0]<=last]
    for method in ORDER:
        pairs=c['predictions'][mode][method]
        kwargs={'color':BLUE if method==best else COLORS[method], 'lw':3 if method==best else 1.3,
                'ls':'--' if method=='persistence' else '-', 'marker':'.','ms':4,
                'zorder':5 if method==best else 3, 'alpha':1 if method in (best,'persistence') else .8}
        continuous(axs[0],pairs,**kwargs)
        changes=[(r['year'],r['predictions'][method]-r['previousObserved']) for r in rows]
        continuous(axs[1],changes,**kwargs)
    continuous(axs[0],observed,color=INK,lw=2.7,marker='o',ms=3.5,zorder=8)
    actual_map=dict(c['observed'])
    changes=[(y,actual_map[y]-actual_map[y-1]) for y in range(first,last+1) if y in actual_map and y-1 in actual_map]
    continuous(axs[1],changes,color=INK,lw=2.7,marker='o',ms=3.5,zorder=8)
    axs[0].axvline(2016.5,color=MUTED,ls=':',lw=1)
    axs[0].set_title('Annual survey levels — three-year averages are not used',loc='left',fontsize=12.5,pad=10)
    axs[0].set_ylabel('Cantril ladder points (0–10)')
    axs[0].set_xticks([2005,2010,2015,2020,2025] if last==2025 else [2005,2010,2015,2020,2024])
    axs[0].set_xlim(2004.8,last+.3)
    axs[1].set_title('Annual changes — a closer match here would capture the swings',loc='left',fontsize=12.5,pad=10)
    axs[1].set_ylabel('Change from prior year\n(ladder points)')
    axs[1].set_xticks(range(first,last+1));axs[1].set_xlim(first-.2,last+.2)
    axs[1].axhline(0,color=MUTED,lw=.8)
    axs[1].set_xlabel('Target year · missing observations and unavailable forecasts remain gaps')
    for ax in axs:
        ax.grid(axis='y');ax.set_axisbelow(True);ax.yaxis.set_major_locator(MaxNLocator(5))
    fig.text(.045,.097,'Blue candidate selected from these retrospective results; not independently confirmed.',fontsize=10.2,weight='bold',color=BLUE)
    fig.text(.045,.070,('Fits update through each prior year.' if mode=='rolling' else 'Frozen 2016 fit; observed prior-year wellbeing anchors each step.')+' Eight preselected countries only.',fontsize=9.4,color=MUTED)
    fig.text(.045,.043,'WHR / Gallup public chart precision: 0.001 points. World Bank inputs. Revised-data study; axes zoom to each country.',fontsize=9.0,color=MUTED)
    save(fig,f'wellbeing-{c["id"].lower()}-{mode}')


def wellbeing_overview():
    methods=['shrinkage_change','change_ridge','residual_carry','country_offset','damped_trend']
    fig,axs=plt.subplots(2,1,figsize=(11.6,10))
    fig.subplots_adjust(left=.32,right=.97,top=.79,bottom=.16,hspace=.6)
    fig.text(.04,.958,'Annual wellbeing remains the weak link',fontsize=24,weight='bold')
    fig.text(.04,.907,'Best rolling candidate: 1.2% less error; only 3 of 8 countries improve.',fontsize=15,weight='bold',color=BAD)
    fig.text(.04,.87,'Using actual annual drivers: all four model candidates lose to repeating last year.',fontsize=13,color=BAD)
    for ax,mode in zip(axs,['rolling','conditional']):
        pool=W['metrics'][mode]['pooled']
        for i,method in enumerate(methods):
            v=pool[method]['percentMAEReductionVsPersistence']
            ax.barh(i,v,color=GOOD if v>0 else BAD,height=.55)
            ax.text(max(v,0)+.7,i,skill_label(v),va='center',color=GOOD if v>0 else BAD,fontsize=11)
        ax.set_yticks(range(len(methods)),[LABELS[m] for m in methods]);ax.tick_params(axis='y',length=0)
        ax.invert_yaxis();ax.axvline(0,color=INK,lw=1);ax.set_xlim(-72,31)
        ax.set_xticks([-60,-40,-20,0,20],['60% worse','40% worse','20% worse','Same','20% better'])
        ax.grid(axis='x');ax.set_axisbelow(True)
        ax.set_title(('One-year forecasts · 69 observations, 2017–2025' if mode=='rolling' else 'Conditional replay · 61 observations, 2017–2024'),fontsize=13,pad=16,loc='left')
    fig.text(.04,.092,'Each bar compares with repeating last year on exactly the same observations within that mode.',fontsize=10.5)
    fig.text(.04,.056,'Modes have different data requirements and fit cutoffs; their pooled scores are not a controlled comparison.\nAll fixed candidates shown; no retuning after scores. These periods and examples are not untouched holdouts.',fontsize=10,color=MUTED)
    save(fig,'wellbeing-overview')


def headline():
    fig,axs=plt.subplots(4,1,figsize=(11.6,9.6))
    fig.subplots_adjust(left=.31,right=.96,top=.77,bottom=.17,hspace=1.05)
    fig.text(.045,.952,'Do annual forecasts improve on repeating last year?',fontsize=22,weight='bold')
    fig.text(.045,.9,'GOOD gains for income and lifespan. Annual happiness swings remain unsolved.',fontsize=13.5,weight='bold')
    info=[]
    for target,label in [('gdp','Income per person'),('life_expectancy','Life expectancy'),('unemployment','Unemployment')]:
        row=min([r for r in O['pooled'] if r['target']==target and r['horizon']==1 and r['method']!='persistence'],key=lambda r:r['mae'])
        info.append((label,row['skill']*100,f"{row['countries']} economies · {row['n']:,} annual forecasts",f"Better in {row['countriesBeatingPersistence']} countries; worse in {row['countriesWorseThanPersistence']}"))
    wp=W['metrics']['rolling']['pooled']['shrinkage_change']
    info.append(('Wellbeing',wp['percentMAEReductionVsPersistence'],'8 preselected countries · 69 annual forecasts','Tiny gain: better in 3 countries; worse in 5'))
    for ax,(label,v,coverage,spread) in zip(axs,info):
        ax.barh([0],[v],height=.46,color=GOOD if v>0 else BAD)
        ax.text(v+.45,0,skill_label(v),va='center',weight='bold',fontsize=13,color=GOOD if v>0 else BAD)
        ax.set_yticks([0],[label],fontsize=15,weight='bold');ax.tick_params(axis='y',length=0,pad=14)
        ax.set_xlim(0,32);ax.set_xticks([]);ax.spines['bottom'].set_visible(False)
        ax.text(0,-.36,coverage,transform=ax.transAxes,fontsize=10.8,color=MUTED)
        ax.text(0,1.08,spread,transform=ax.transAxes,fontsize=11.5,color=BAD if label in ('Wellbeing','Unemployment') else GOOD)
    fig.text(.045,.089,'Error reduction = 100 × (1 − model error / repeat-last-year error). More is better.',fontsize=11.5,weight='bold')
    fig.text(.045,.05,'Separate targets and units; no combined happiness score. Each best candidate chosen from these saved results.\nLatest-vintage retrospective tests, not independent confirmation. Close levels alone do not prove spike prediction.',fontsize=10.5,color=MUTED)
    save(fig,'00-annual-results')


if __name__=='__main__':
    for country in W['countries']:
        for mode in ('rolling','conditional'):
            wellbeing_country(country,mode)
    wellbeing_overview();headline()
    manifest={'operation':'Plot saved study outputs only; no fitting or scored study rerun',
      'sources':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (WPATH,OPATH)},
      'matplotlib':matplotlib.__version__, 'files':sorted(p.name for p in OUT.glob('wellbeing-*.png'))+['00-annual-results.png']}
    (OUT/'wellbeing-presentation.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Rendered16country wellbeing plots +2overviews from frozen evidence.')
