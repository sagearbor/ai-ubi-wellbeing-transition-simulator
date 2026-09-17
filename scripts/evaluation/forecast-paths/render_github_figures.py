"""Plot existing artifacts for GitHub's Markdown preview; no fit or scored run.

Requires matplotlib==3.10.8. PNGs render directly on GitHub and on phones.
"""
import hashlib
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.ticker import FuncFormatter, MaxNLocator

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'data/evaluation/diagnostic-health-income-2018-v1/paths.json'
OUT = ROOT / 'docs/design/reviews/figures/2026-09-16-forecast-paths'
OUT.mkdir(parents=True, exist_ok=True)
DATA = json.loads(SOURCE.read_text())
COUNTRIES = {c['id']: c for c in DATA['countries']}
GOOD, BAD, INK, MUTED, BLUE = '#177a50', '#bb3446', '#17263e', '#526176', '#315dd4'
COLORS = {'endpoint_blend': BLUE, 'g_offset': '#16918a', 'c_decay': '#b77614', 'g_health': '#8c57a9', 'income_only': '#547951', 'saturated_income': '#8b7861', 'observed': INK, 'persistence': '#78808c'}
LABELS = {m['id']: m['name'].replace(' (new)', '') for m in DATA['models']}
LABELS.update(endpoint_blend='Selected 75/25 blend*', simple_blend='Equal 50/50 blend*', diagnostic_mean='New four-model average')
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 13, 'text.color': INK,
 'axes.labelcolor': INK, 'xtick.color': MUTED, 'ytick.color': INK, 'axes.edgecolor': '#d3dae4',
 'figure.facecolor': 'white', 'axes.facecolor': 'white', 'savefig.facecolor': 'white',
 'axes.spines.top': False, 'axes.spines.right': False, 'axes.spines.left': False,
 'axes.titleweight': 'bold', 'grid.color': '#e6eaf0'})

def title(fig, headline, subtitle):
    fig.text(.045, .958, headline, fontsize=23, weight='bold', va='top')
    fig.text(.045, .910, subtitle, fontsize=12.5, color=MUTED, va='top')

def save(fig, name):
    fig.savefig(OUT / (name + '.png'), dpi=160)
    plt.close(fig)

def error_label(skill):
    value=abs(skill * 100)
    precision=2 if value<.1 else 1
    return f'{value:.{precision}f}% ' + ('less error' if skill>0 else 'more error' if skill<0 else 'same error')

def ranking():
    ids=sorted([k for k in DATA['metrics'] if k!='persistence'], key=lambda k:DATA['metrics'][k]['ladder']['endpoint']['skill'], reverse=True)
    fig,ax=plt.subplots(figsize=(12,10.2))
    fig.subplots_adjust(left=.335,right=.97,bottom=.15,top=.845)
    title(fig,'Which models predicted wellbeing better?', '2025 endpoint test • green = less error than staying at 2018 • red = more error')
    for y,key in enumerate(ids):
        skill=DATA['metrics'][key]['ladder']['endpoint']['skill'];value=100*skill
        ax.barh(y,value,height=.58,color=GOOD if skill>0 else BAD)
        ax.text(max(value,0)+.65,y,error_label(skill),va='center',fontsize=12,color=GOOD if skill>0 else BAD,weight='bold' if key in ['endpoint_blend','g_offset','legacy'] else 'normal')
    ax.set_yticks(range(len(ids)),[LABELS[k] for k in ids]);ax.tick_params(axis='y',length=0,pad=12)
    ax.invert_yaxis();ax.axvline(0,color=INK,linewidth=1.15);ax.set_xlim(-23,29)
    ax.set_xticks([-20,-10,0,10,20],['20% worse','10% worse','Same','10% better','20% better'])
    ax.xaxis.grid(True);ax.set_axisbelow(True);ax.set_xlabel('Reduction in average absolute prediction error',labelpad=14)
    ax.axvline(20,color='#96a0af',linestyle=(0,(3,4)),linewidth=1)
    fig.text(.045,.076,'GOOD: country offsets beat persistence. BAD: the original model loses; no entry reaches 20%.',fontsize=12,weight='bold')
    fig.text(.045,.043,'97 countries with 2025 ladder observations. *Blend weights chosen after outcomes were known.\nThese are observed test results, not statistically established future gains.',fontsize=10.5,color=MUTED,va='center')
    save(fig,'01-wellbeing-good-bad')

def wealth_gap():
    ids=['endpoint_blend','g_offset','c_decay','g_health','income_only']
    fig,ax=plt.subplots(figsize=(12,7))
    fig.subplots_adjust(left=.28,right=.97,bottom=.19,top=.79)
    title(fig,'A better overall score can hide worse predictions', 'The same 2025 wellbeing test, split by the countries being evaluated')
    for i,key in enumerate(ids):
        for j,(scope,label) in enumerate([('endpoint','All scored countries'),('endpoint_Q4','Richest quarter')]):
            y=2.1*i+.75*j;skill=DATA['metrics'][key]['ladder'][scope]['skill'];v=skill*100
            ax.barh(y,v,height=.56,color=GOOD if skill>=0 else BAD,alpha=1 if j else .8)
            ax.text(v-.6 if v<0 else v+.6,y,f'{label}: {error_label(skill)}',ha='right' if v<0 else 'left',va='center',fontsize=10.5,color=GOOD if skill>=0 else BAD)
    ax.set_yticks([2.1*i+.375 for i in range(len(ids))],[LABELS[k] for k in ids]);ax.tick_params(axis='y',length=0,pad=10)
    ax.invert_yaxis();ax.axvline(0,color=INK,linewidth=1);ax.set_xlim(-78,55);ax.set_xticks([-60,-30,0,30],['60% worse','30% worse','Same','30% better']);ax.xaxis.grid(True);ax.set_axisbelow(True)
    fig.text(.045,.105,'BAD: every model shown makes the richest-quarter forecast worse than persistence.',fontsize=12,weight='bold',color=BAD)
    fig.text(.045,.045,'All countries: 97 observed endpoints. Richest quarter: 25 countries, ranked by 2018 income.\nThe two groups have separate persistence-error denominators. This is not a causal income effect.',fontsize=10.5,color=MUTED)
    save(fig,'02-rich-country-limit')

def trajectories(future=False):
    fig,axes=plt.subplots(2,1,figsize=(12,11.3))
    fig.subplots_adjust(left=.1,right=.97,bottom=.09,top=.745,hspace=.62)
    title(fig,'What the models project next' if future else 'The forecast lines versus what actually happened',
          'Illustrative 2025 → 2032 paths • no future accuracy score' if future else 'Historical test: all forecasts began in 2018 • closer to the dark line is better')
    ids=['g_offset','c_decay','g_health','persistence','endpoint_blend']
    handles=[Line2D([0],[0],color=COLORS[k],lw=3.5 if k in ['endpoint_blend','observed'] else 1.8,linestyle='--' if k=='persistence' else '-') for k in ['observed']+ids]
    labels=['Observed','Country offsets','Decaying offsets','Health + income','Persistence','Selected blend*']
    fig.legend(handles,labels,ncol=3,loc='upper left',bbox_to_anchor=(.085,.874),frameon=False,fontsize=11.5,columnspacing=1.9)
    for ax,id in zip(axes,['USA','IND']):
        c=COUNTRIES[id];view='future' if future else 'historical';origin=2025 if future else 2018
        for key in ids:
            pts=c[view][key]['ladder'];ax.plot([p[0] for p in pts],[p[1] for p in pts],color=COLORS[key],linewidth=3.7 if key=='endpoint_blend' else 1.8,linestyle='--' if key=='persistence' else '-',zorder=5 if key=='endpoint_blend' else 3)
        pts=[p for p in c['observed']['ladder'] if p[0]>=(2021 if future else 2015)]
        ax.plot([p[0] for p in pts],[p[1] for p in pts],color=INK,linewidth=3,marker='o',markersize=4,zorder=6)
        ax.axvline(origin,color='#9fa8b7',linestyle=':',linewidth=1.2)
        ax.set_ylabel('Wellbeing: ladder points (0–10)',fontsize=11.5)
        ax.set_xticks([2021,2023,2025,2027,2029,2032] if future else [2015,2017,2018,2020,2022,2025]);ax.yaxis.set_major_locator(MaxNLocator(5));ax.grid(axis='y');ax.set_axisbelow(True)
        ax.set_title(c['name'],loc='left',fontsize=17,pad=31)
        if future:
            ax.text(0,1.045,'UNSCORED: same old fits, reset to the observed 2025 starting point',transform=ax.transAxes,fontsize=10.5,color=MUTED)
            ax.axvspan(2025,2032,color=BLUE,alpha=.04,zorder=0)
        else:
            actual=c['observed']['ladder'][-1][1];pred=c['historical']['endpoint_blend']['ladder'][-1][1];base=c['historical']['persistence']['ladder'][-1][1]
            model_error=abs(pred-actual);base_error=abs(base-actual);good=model_error<base_error
            ax.text(0,1.045,f"{'GOOD' if good else 'BAD'} at 2025: blend misses by {model_error:.3f} points; persistence by {base_error:.3f}",transform=ax.transAxes,fontsize=11,color=GOOD if good else BAD,weight='bold')
    fig.text(.045,.027,('Future paths use unchanged 2018 calibrations. No new AI or policy shock. *Weights selected on known outcomes.\n' if future else '*Blend weights selected after outcomes were known. US and India illustrate contrasting results, not the whole cohort.\n')+'Wellbeing observations are trailing three-year survey averages. Each vertical axis zooms to its country’s range.',fontsize=10.5,color=MUTED)
    save(fig,'04-future-paths' if future else '03-history-versus-forecasts')

def income_scores():
    ids=['g_offset','endpoint_blend','g_health','g_damped','g_changes','simple_blend','c_decay','g_ensemble']
    names={**LABELS,'g_health':'Health + income / new variants','c_decay':'Decay / retained / original GDP'}
    ids.sort(key=lambda k:DATA['metrics'][k]['gdp']['endpoint']['skill'],reverse=True)
    fig,ax=plt.subplots(figsize=(12,7.2))
    fig.subplots_adjust(left=.365,right=.97,bottom=.18,top=.80)
    title(fig,'Income forecasts are a separate score', '2025 GDP per person • green = less error than keeping income at its 2018 level')
    for i,key in enumerate(ids):
        skill=DATA['metrics'][key]['gdp']['endpoint']['skill'];v=skill*100
        ax.barh(i,v,height=.6,color=GOOD if skill>=0 else BAD)
        ax.text(v+.7,i,error_label(skill),va='center',fontsize=12,color=GOOD if skill>=0 else BAD)
    ax.set_yticks(range(len(ids)),[names[k] for k in ids]);ax.tick_params(axis='y',length=0,pad=12);ax.invert_yaxis();ax.set_xlim(0,65)
    ax.set_xticks([0,20,40,60],['Same','20% better','40% better','60% better']);ax.xaxis.grid(True);ax.set_axisbelow(True)
    fig.text(.045,.09,'GOOD on income does not mean GOOD on wellbeing: these are different targets.',fontsize=12,weight='bold')
    fig.text(.045,.039,'97 observed GDP endpoints. Errors are normalized by each country’s 2018 GDP per person.\nVariants with identical GDP forecasts share a row. *Blend weights were selected for wellbeing, not income.',fontsize=10.5,color=MUTED)
    save(fig,'05-income-good-bad')

ranking();wealth_gap();trajectories();trajectories(True);income_scores()
(OUT/'provenance.json').write_text(json.dumps({'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'matplotlib':matplotlib.__version__,'operation':'Presentation of existing saved results; no training or scoring invocation. Country error annotations are arithmetic on the displayed saved paths.','files':sorted(p.name for p in OUT.glob('*.png'))},indent=2)+'\n')
print('Rendered five figures in',OUT)
