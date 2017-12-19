import pandas as pd
from functree import tree
from functree.analysis import module_coverage, direct_mapping, basic_mapping


def calc_abundances(df, nodes, method, results):
    df_out = pd.DataFrame(columns=df.columns)
    for node in nodes:
        d = None
        # Skip nodes which was already in df_out or have a name with "*" (e.g. *Module undefined*)
        if node['entry'] in df_out.index or node['entry'].startswith('*'):
            continue

        if 'children' not in node:
            try:
                d = df.loc[node['entry']]
            except KeyError:
                pass
        else:
            targets = [child_node['entry'] for child_node in tree.get_nodes(node) if 'children' not in child_node]
            try:
                loc = df.loc[targets]
                d = eval('loc.{}()'.format(method))
            except KeyError:
                pass
        df_out.ix[node['entry']] = d

    df_out = df_out.dropna(how='all').fillna(0.0)
    results[method] = df_out