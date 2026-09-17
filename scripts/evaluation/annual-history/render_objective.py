"""Render fixed annual objective evidence. Reads saved rows; never fits or scores."""
import json
import os
from collections import defaultdict
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/private/tmp/alignment-graphs-mpl")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, MaxNLocator
from matplotlib.patches import Patch
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data/evaluation/annual-objective-20260917"
OUT = ROOT / "docs/design/reviews/figures/annual-history-20260917"
COUNTRIES = ["USA", "IND", "DEU", "GBR", "BRA", "JPN", "ZAF", "CHN"]
TARGETS = ["gdp", "life_expectancy", "unemployment"]
METHODS = ["damped_trend", "target_shrinkage", "ridge_changes"]
TITLES = {"gdp": "Real GDP per person", "life_expectancy": "Life expectancy", "unemployment": "Unemployment rate"}
LEVEL_UNITS = {"gdp": "Constant 2015 US dollars", "life_expectancy": "Years of life at birth", "unemployment": "% of the labor force"}
CHANGE_UNITS = {"gdp": "% of previous-year GDP", "life_expectancy": "Change in years", "unemployment": "Change in percentage points"}
ERROR_UNITS = {"gdp": "% of previous-year GDP", "life_expectancy": "years", "unemployment": "percentage points"}
BLUE, BLACK, GRAY = "#0068b4", "#111820", "#7b838b"
GREEN, RED = "#137f4b", "#bf3543"
COLORS = ["#c17816", "#8854ad"]

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 14, "axes.titlesize": 17,
                     "axes.labelsize": 14, "xtick.labelsize": 13, "ytick.labelsize": 13,
                     "axes.spines.top": False, "axes.spines.right": False,
                     "axes.edgecolor": "#b9c0c8", "text.color": BLACK,
                     "axes.labelcolor": BLACK, "savefig.facecolor": "white"})


def method_name(method, target):
    if method == "persistence":
        return "Last observed value"
    if method == "damped_trend":
        return "Damped recent trend"
    if method == "ridge_changes":
        return "Recent-change model"
    return {"gdp": "Conservative growth", "life_expectancy": "Conservative trend",
            "unemployment": "Reversion toward past average"}[target]


def decorate_axis(ax):
    ax.grid(axis="y", color="#e3e7ed", linewidth=0.7)
    ax.set_axisbelow(True)
    ax.tick_params(length=0, pad=7)
    ax.yaxis.set_major_locator(MaxNLocator(nbins=5))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:,.0f}" if abs(value) >= 1000 else f"{value:g}"))


def series_array(rows, field, years):
    by_year = {r["year"]: r[field] for r in rows}
    assert len(by_year) == len(rows), "Duplicate plot years"
    # Fill the annual display grid with NaNs, never connect across missing years.
    return np.array([np.nan if by_year.get(year) is None else by_year[year] for year in years], dtype=float)


def render_country(country, target, paths, metrics, selected):
    observed = [r for r in paths["observations"] if r["country"] == country and r["target"] == target]
    predictions = [r for r in paths["predictions"] if r["country"] == country and r["target"] == target and r["horizon"] == 1]
    chosen = selected[target]
    stat = next(r for r in metrics["countries"] if (r["country"], r["target"], r["horizon"], r["method"]) == (country, target, 1, chosen))
    observed_nonnull = [r for r in observed if r["value"] is not None]
    start, end = min(r["year"] for r in observed_nonnull), max(r["year"] for r in observed_nonnull)
    years = list(range(start, 2026))
    name = observed[0]["name"]
    good = stat["skill"] > 0
    verdict, status_color = ("GOOD", GREEN) if good else ("BAD", RED)
    skill_text = f"{abs(stat['skill']) * 100:.1f}% {'less' if good else 'more'} error than last observed value"
    scored_years = [r["year"] for r in predictions if r["method"] == chosen and r["actual"] is not None]
    fig, axes = plt.subplots(2, 1, figsize=(12, 13), gridspec_kw={"height_ratios": [1.12, 1]})
    fig.subplots_adjust(top=0.72, bottom=0.20, left=0.12, right=0.965, hspace=0.45)
    fig.text(0.055, 0.967, f"{verdict} — {name} · {TITLES[target]}", fontsize=23, weight="bold", color=status_color, va="top")
    fig.text(0.055, 0.920, skill_text, fontsize=21, weight="bold", color=status_color)
    fig.text(0.055, 0.884, f"Mean absolute error: selected model {stat['mae']:.3f} vs last value {stat['baselineMAE']:.3f} {ERROR_UNITS[target]}.", fontsize=13)
    fig.text(0.055, 0.858, f"Same {stat['n']} observed country-years, {min(scored_years)}–{max(scored_years)}; one-year forecasts updated every year.", fontsize=13)
    actual_levels = series_array(observed, "value", years)
    handles = []
    handles.append(axes[0].plot(years, actual_levels, color=BLACK, linewidth=2.8, zorder=8, label="Observed / source estimate")[0])
    by_method = defaultdict(list)
    for r in predictions:
        assert r["trainingCutoff"] == r["originYear"] == r["year"] - 1
        by_method[r["method"]].append(r)
    ordered_methods = ["persistence", chosen] + [m for m in METHODS if m != chosen]
    remaining_color = {m: c for m, c in zip([m for m in METHODS if m != chosen], COLORS)}
    style = {}
    for method in ordered_methods:
        color = GRAY if method == "persistence" else BLUE if method == chosen else remaining_color[method]
        style[method] = {"color": color, "linewidth": 3.0 if method == chosen else 1.65,
                         "linestyle": "--" if method == "persistence" else "-", "alpha": 0.92,
                         "zorder": 7 if method == chosen else 4}
        label = method_name(method, target) + (" · selected" if method == chosen else "")
        handles.append(axes[0].plot(years, series_array(by_method[method], "prediction", years), label=label, **style[method])[0])
    leg = fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(0.049, 0.837), frameon=False,
                     ncol=2, fontsize=12.5, columnspacing=1.5, handlelength=2.8, borderaxespad=0)
    for text in leg.get_texts():
        if "selected" in text.get_text():
            text.set_color(BLUE)
            text.set_weight("bold")
    axes[0].set_title(f"Full published history · {start}–{end}", loc="left", weight="bold", pad=12)
    axes[0].set_ylabel(LEVEL_UNITS[target])
    axes[0].set_xlim(start, 2025.6)
    if target == "unemployment":
        axes[0].set_xticks([1991, 2000, 2010, 2020, 2025])
    else:
        axes[0].set_xticks([1960, 1980, 2000, 2020, 2025])
    recent_start = 2011 if target == "unemployment" else 2000
    recent_years = list(range(recent_start, 2026))
    axes[1].plot(recent_years, series_array(by_method[chosen], "actualChange", recent_years),
                 color=BLACK, linewidth=2.8, zorder=8, marker="o", markersize=3.1)
    for method in ordered_methods:
        axes[1].plot(recent_years, series_array(by_method[method], "predictedChange", recent_years), **style[method])
    axes[1].axhline(0, color="#9199a2", linewidth=0.7, zorder=1)
    axes[1].set_title("Annual changes · can the model predict movement?", loc="left", weight="bold", pad=12)
    axes[1].set_ylabel(CHANGE_UNITS[target])
    axes[1].set_xlabel("Target year · each forecast uses history through the previous year", labelpad=11)
    axes[1].set_xlim(recent_start - 0.3, 2025.6)
    axes[1].set_xticks([2011, 2015, 2020, 2025] if target == "unemployment" else [2000, 2005, 2010, 2015, 2020, 2025])
    for ax in axes:
        decorate_axis(ax)
        if end < 2025:
            ax.axvspan(2024.55, 2025.6, color="#eef0f4", zorder=0)
    fig.text(0.055, 0.107, "Blue model selected from these retrospective results; not independently confirmed.", color=BLUE, fontsize=13, weight="bold")
    fig.text(0.055, 0.080, "Every point is a new forecast from 20 prior annual values — not one forecast from the start of history.", fontsize=12.5)
    source_note = {"gdp": "Real GDP is inflation-adjusted, not purchasing-power adjusted.",
                   "life_expectancy": "2025 actual is missing (shaded); annual source estimates can be interpolated.",
                   "unemployment": "ILO modeled estimates start in 1991; 20-year training delays forecasts until 2011."}[target]
    fig.text(0.055, 0.054, source_note, fontsize=12)
    fig.text(0.055, 0.029, "World Bank, latest vintage retrieved 17 Sep 2026 · revised historical estimates · missing years remain gaps.", fontsize=11.5, color="#56616e")
    path = OUT / f"objective-{country.lower()}-{target}.png"
    fig.savefig(path, dpi=145)
    plt.close(fig)
    return path.name


def render_overview(metrics):
    fig, axes = plt.subplots(3, 1, figsize=(12, 14))
    fig.subplots_adjust(top=0.805, bottom=0.14, left=0.31, right=0.88, hspace=0.58)
    fig.text(0.055, 0.97, "Annual objective forecasts: gains and losses", fontsize=25, weight="bold", va="top")
    fig.text(0.055, 0.925, "Do fixed models beat the last observed value?", fontsize=21)
    fig.text(0.055, 0.89, "Green = smaller error · Red = larger error · all 18 comparisons shown", fontsize=15)
    fig.legend(handles=[Patch(facecolor="#9199a2", label="One year ahead"),
                        Patch(facecolor="#cbd1d8", edgecolor="#596572", hatch="///", label="Five years ahead")],
               loc="upper right", bbox_to_anchor=(0.95, 0.882), frameon=False, ncol=2, fontsize=13)
    for ax, target in zip(axes, TARGETS):
        for method_index, method in enumerate(METHODS):
            for horizon, offset in [(1, -0.18), (5, 0.18)]:
                r = next(r for r in metrics["pooled"] if (r["target"], r["horizon"], r["method"]) == (target, horizon, method))
                percent = 100 * r["skill"]
                color = GREEN if percent > 0 else RED
                ax.barh(method_index + offset, percent, height=0.30, color=color,
                        alpha=1 if horizon == 1 else 0.55, edgecolor=color, hatch=None if horizon == 1 else "///")
                ax.text(percent + (0.8 if percent >= 0 else -0.8), method_index + offset,
                        f"{percent:+.1f}%", va="center", ha="left" if percent >= 0 else "right",
                        color=color, fontsize=14, weight="bold")
        ax.axvline(0, color=BLACK, linewidth=1)
        ax.set_yticks(range(3), [method_name(m, target) for m in METHODS])
        ax.invert_yaxis()
        ax.set_xlim(-39, 42)
        ax.set_xticks([-30, -15, 0, 15, 30])
        ax.set_xlabel("Error reduction versus last observed value (%)", labelpad=9)
        ax.set_title(TITLES[target], loc="left", fontsize=20, weight="bold", pad=13)
        ax.grid(axis="x", color="#e3e7ed", linewidth=0.7)
        ax.set_axisbelow(True)
        ax.tick_params(length=0, pad=9, labelsize=13)
    fig.text(0.055, 0.057, "Each target and horizon uses its own matched observations; unlike units are never pooled.", fontsize=13)
    fig.text(0.055, 0.032, "One fixed retrospective comparison · World Bank revised estimates · gains are not independent confirmation.", fontsize=12, color="#56616e")
    path = OUT / "objective-overview.png"
    fig.savefig(path, dpi=145)
    plt.close(fig)
    return path.name


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    paths = json.loads((DATA / "example-paths.json").read_text())
    metrics = json.loads((DATA / "metrics.json").read_text())
    selected = {target: min((r for r in metrics["pooled"] if r["target"] == target and r["horizon"] == 1 and r["method"] in METHODS),
                           key=lambda r: r["mae"])["method"] for target in TARGETS}
    filenames = [render_country(country, target, paths, metrics, selected) for country in COUNTRIES for target in TARGETS]
    filenames.append(render_overview(metrics))
    print(json.dumps({"files": filenames, "selectedByPooledOneYearMAE": selected,
                      "note": "Read saved forecasts and metrics only; no model fit or scoring execution."}, indent=2))


if __name__ == "__main__":
    main()
