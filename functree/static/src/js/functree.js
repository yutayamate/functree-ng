'use strict';

const DEFAULT_CONFIG = {
    'elementId': 'functree',
    'width': 1800,
    'height': 1800,
    'viewBoxWidth': 1200,
    'viewBoxHeight': 1200,
    'diameter': 800,
    'duration': 1000,
    'normalize': true,
    'displayRounds': true,
    'displayBars': false,
    'displayNodesLowerThan': 5,
    'color': {
        'class': [
            '#5f5f5f',
            '#2F57D0',
            '#5381DF',
            '#41B360',
            '#E0462F',
            '#DA9F33'
        ]
    },
    'external': {
        'entry': 'vmEntryDetail.entry'
    }
}

const FuncTree = class {
    constructor(root, config={}) {
        this.root = root;
        this.root.x0 = 0;
        this.root.y0 = 0;
        this.nodes = this.getNodes();
        this.config = Object.assign(DEFAULT_CONFIG, config);
        this.tree = d3.layout.tree()
            .size([360, this.config.diameter / 2]);
        let id = 0;
        for (const node of this.nodes) {
            node.id = id++;
        }
        this.initTree();
    }

    configure(config=DEFAULT_CONFIG) {
        this.config = Object.assign(this.config, config);
        return this;
    }

    initTree() {
        for (const node of this.nodes) {
            node.values = [];
            node.value = 0;
            node.cols = [];
            if (node.children && node.depth >= this.config.displayNodesLowerThan - 1) {
                node._children = node.children;
                node.children = null;
            }
            if (node._children && node.depth < this.config.displayNodesLowerThan - 1) {
                node.children = node._children;
                node._children = null;
            }
        }
        return this;
    }

    create(elementId=this.config.elementId, width=this.config.width, height=this.config.height) {
        const svg = d3.select('#' + elementId)
            .insert('svg', ':first-child')
            .attr('xmlns', 'http://www.w3.org/2000/svg')
            .attr('version', '1.1')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', '0 0 ' + this.config.viewBoxWidth + ' ' + this.config.viewBoxHeight);
        const buffer = svg.append('g')
            .attr('id', 'buffer')
            .attr('transform', 'translate(' + this.config.viewBoxWidth / 2 + ',' + this.config.viewBoxHeight / 2 + '),scale(1)');
        const groupIds = [
            'rings',
            'links',
            'charts',
            'rounds',
            'labels',
            'nodes'
        ];
        for (const i of groupIds) {
            buffer.append('g').attr('id', i);
        }
        svg.call(d3.behavior.zoom()
            .translate([this.config.viewBoxWidth / 2, this.config.viewBoxHeight / 2])
            .scaleExtent([0.5, 10])
            .on('zoom', () => {
                buffer.attr({
                    'transform': 'translate(' + d3.event.translate + '),scale(' + d3.event.scale + ')'
                });
            })
        );
        return this;
    }

    update(source=this.root) {
        const nodes = this.tree.nodes(this.root);
        const links = this.tree.links(nodes);
        const depth = d3.max(
            nodes.map((x) => {
                return x.depth;
            })
        );

        const getClassMax = (nodes, maxFunc) => {
            return Array.from(new Array(depth + 1))
                .map((v, i) => {
                    const candidates = nodes
                        .filter((x) => {
                            return x.depth === i;
                        })
                        .map(maxFunc);
                    return d3.max(candidates);
                });
        };
        const maxValue = getClassMax(nodes, (x) => {
            return x.value;
        });
        const maxSumOfValues = getClassMax(nodes, (x) => {
            return d3.sum(x.values);
        });
        const maxMaxOfValues = getClassMax(nodes, (x) => {
            return d3.max(x.values);
        });

        this._updateRings(depth);
        this._updateLinks(links, source);
        this._updateNodes(nodes, source);
        this._updateBars(nodes, source, depth, maxSumOfValues, maxMaxOfValues);
        this._updateRounds(nodes, source, depth, maxValue);
        this._updateLabels(nodes, source, maxValue, maxSumOfValues);

        for (const node of nodes) {
            node.x0 = node.x;
            node.y0 = node.y;
        }

        // Enable showing tooltip by Bootstrap
        $('[data-toggle="tooltip"]').tooltip({
            container: 'body',
            placement: 'top'
        });
    }

    _updateRings(depth) {
        const ring = d3.select('#rings')
            .selectAll('circle')
            .data(d3.range(1, depth, 2));
        ring.enter()
            .append('circle')
            .attr('fill', 'none')
            .attr('r', (d) => {
                return (this.config.diameter / 2) / depth * (d + 0.5) || 0;
            })
            .attr('stroke', '#f8f8f8')
            .attr('stroke-width', 0);
        ring
            .transition()
            .duration(this.config.duration)
            .attr('r', (d) => {
                return (this.config.diameter / 2) / depth * (d + 0.5) || 0;
            })
            .attr('stroke-width', (this.config.diameter / 2) / depth || 0);
        ring.exit()
            .transition()
            .duration(this.config.duration)
            .attr('stroke-width', 0)
            .remove();
    }

    _updateLinks(links, source) {
        const diagonal = d3.svg.diagonal.radial()
            .projection((d) => {
                return [d.y, d.x / 180 * Math.PI];
            });
        const straight = (d) => {
            const x = (d) => {
                return d.y * Math.cos((d.x - 90) / 180 * Math.PI);
            };
            const y = (d) => {
                return d.y * Math.sin((d.x - 90) / 180 * Math.PI);
            };
            return 'M' + x(d.source) + ',' + y(d.source) + 'L' + x(d.target) + ',' + y(d.target);
        };
        const link = d3.select('#links')
            .selectAll('path')
            .data(links, (d) => {
                return d.target.id;
            });
        link.enter()
            .append('path')
            .attr('fill', 'none')
            .attr('stroke', '#999')
            .attr('stroke-width', 0.5)
            .attr('stroke-dasharray', (d) => {
                if (d.source.depth === 0) {
                    return '3,3';
                }
            })
            .attr('d', (d) => {
                const o = {
                    'x': source.x0,
                    'y': source.y0
                };
                const vector = {
                    'source': o,
                    'target': o
                };
                if (d.source.depth === 0) {
                    return straight(vector);
                } else {
                    return diagonal(vector);
                }
            })
            .on('mouseover', (d) => {
                this._highlightLinks(d.target);
            })
            .on('mouseout', () => {
                d3.select('#links')
                    .selectAll('path')
                    .attr('style', null);
            });
        link
            .transition()
            .duration(this.config.duration)
            .attr('d', (d) => {
                if (d.source.depth === 0) {
                    return straight(d);
                } else {
                    return diagonal(d);
                }
            });
        link.exit()
            .transition()
            .duration(this.config.duration)
            .attr('d', (d) => {
                const o = {
                    'x': source.x,
                    'y': source.y
                };
                const vector = {
                    'source': o,
                    'target': o
                };
                if (d.source.depth === 0) {
                    return straight(vector);
                } else {
                    return diagonal(vector);
                }
            })
            .remove();
    }

    _updateNodes(nodes, source) {
        const node = d3.select('#nodes')
            .selectAll('circle')
            .data(nodes, (d) => {
                return d.id;
            });
        node.enter()
            .append('circle')
            .attr('transform', () => {
                return 'rotate(' + (source.x0 - 90) + '),translate(' + source.y0 + ')';
            })
            .attr('r', 1)
            .attr('fill', (d) => {
                return d._children ? '#ddd' : '#fff';
            })
            .attr('stroke', '#999')
            .attr('stroke-width', 0.5)
            .attr('cursor', 'pointer')
            .attr('data-toggle', 'tooltip')
            .attr('data-original-title', (d) => {
                return '[' + d.entry + '] ' + d.name;
            })
            .on('click', (d) => {
                this._collapseChildren(d);
                this.update(d);
            })
            .on('mouseover', (d) => {
                if (this.config.external.entry) {
                    eval(this.config.external.entry + ' = d.entry');
                }
                d3.select(d3.event.target)
                    .style('r', 10)
                    .style('fill', '#000')
                    .style('opacity', 0.5);
                this._highlightLinks(d);
            })
            .on('mouseout', () => {
                d3.select(d3.event.target)
                    .attr('style', null);
                d3.select('#links')
                    .selectAll('path')
                    .attr('style', null);
            });
        node
            .transition()
            .duration(this.config.duration)
            .attr('fill', (d) => {
                return d._children ? '#ddd' : '#fff';
            })
            .attr('transform', (d) => {
                return 'rotate(' + (d.x - 90) + '),translate(' + d.y + ')';
            });
        node.exit()
            .transition()
            .duration(this.config.duration)
            .attr('r', 0)
            .attr('transform', () => {
                return 'rotate(' + (source.x - 90) + '),translate(' + source.y + ')';
            })
            .remove();
    }

    _updateBars(nodes, source, depth, maxSumOfValues, maxMaxOfValues) {
        const config = this.config;
        const chart = d3.select('#charts')
            .selectAll('g')
            .data(nodes, (d) => {
                return d.id;
            });
        chart.enter()
            .append('g')
            .attr('transform', 'rotate(' + (source.x0 - 90) + '),translate(' + source.y0 + '),rotate(-90)')
            .attr('data-toggle', 'tooltip')
            .attr('data-original-title', function(d) {
                return '[' + d.entry + '] ' + d.name;
            })
            .on('click', (d) => {
                this._collapseChildren(d);
                this.update(d);
            })
            .on('mouseover', (d) => {
                if (this.config.external.entry) {
                    eval(this.config.external.entry + ' = d.entry');
                }
                this._highlightLinks(d);
            })
            .on('mouseout', () => {
                d3.select('#links')
                    .selectAll('path')
                    .attr('style', null);
            });
        chart
            .transition()
            .duration(this.config.duration)
            .attr('transform', (d) => {
                return 'rotate(' + (d.x - 90) + '),translate(' + d.y + '),rotate(-90)';
            });
        chart.exit()
            .transition()
            .duration(this.config.duration)
            .attr('transform', 'rotate(' + (source.x - 90) + '),translate(' + source.y + '),rotate(-90)')
            .remove();

        const bar = chart
            .selectAll('rect')
            .data((d) => {
                return d.values;
            });
        bar.enter()
            .append('rect')
            .attr('x', -1)
            .attr('y', 0)
            .attr('width', 2)
            .attr('height', 0)
            .attr('fill', function(d, i) {
                const n = i % config.color.class.length;
                return config.color.class[n];
            })
            .on('mouseover', (d) => {
                d3.select(d3.event.target)
                    .style('fill', '#000')
                    .style('opacity', 0.5);
                this._highlightLinks(d);
            })
            .on('mouseout', () => {
                d3.select(d3.event.target)
                    .attr('style', null);
                d3.select('#charts')
                    .selectAll('rect')
                    .attr('style', null);
            });
        bar
            .transition()
            .duration(this.config.duration)
            .attr('y', function(d, i) {
                const p = this.parentNode.__data__;
                const maxHight = config.diameter / 2 / depth * 0.8;
                const subSum = d3.sum(p.values.slice(0, i));
                if (config.normalize) {
                    return subSum / maxSumOfValues[p.depth] * maxHight || 0;
                } else {
                    return subSum;
                }
            })
            .attr('height', function(d) {
                const p = this.parentNode.__data__;
                const maxHight = config.diameter / 2 / depth * 0.8;
                if (config.normalize) {
                    return d / maxSumOfValues[p.depth] * maxHight || 0;
                } else {
                    return d;
                }
            });
        bar.exit()
            .transition()
            .duration(this.config.duration)
            .attr('y', 0)
            .attr('height', 0)
            .remove();
    }

    _updateRounds(nodes, source, depth, max) {
        const circle = d3.select('#rounds')
            .selectAll('circle')
            .data(nodes, (d) => {
                return d.id;
            });
        circle.enter()
            .append('circle')
            .attr('transform', () => {
                return 'rotate(' + (source.x0 - 90) + '),translate(' + source.y0 + ')';
            })
            .attr('r', 0)
            .attr('fill', (d) => {
                if (this.config.displayBars) {
                    return '#fff';
                } else {
                    const n = d.depth % this.config.color.class.length;
                    return this.config.color.class[n];
                }
            })
            .attr('stroke', () => {
                return this.config.displayBars ? '#333' : '#fff';
            })
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.75)
            .attr('data-toggle', 'tooltip')
            .attr('data-original-title', (d) => {
                return '[' + d.entry + '] ' + d.name;
            })
            .on('click', (d) => {
                this._collapseChildren(d);
                this.update(d);
            })
            .on('mouseover', (d) => {
                if (this.config.external.entry) {
                    eval(this.config.external.entry + ' = d.entry');
                }
                d3.select(d3.event.target)
                    .style('fill', '#000')
                    .style('opacity', 0.5);
                this._highlightLinks(d);
            })
            .on('mouseout', () => {
                d3.select(d3.event.target)
                    .attr('style', null);
                d3.select('#links')
                    .selectAll('path')
                    .attr('style', null);
            });
        circle
            .transition()
            .duration(this.config.duration)
            .attr('r', (d) => {
                const r_ = 25;
                if (this.config.normalize) {
                    return d.value / max[d.depth] * r_ || 0;
                } else {
                    return d.value;
                }
            })
            .attr('transform', (d) => {
                return 'rotate(' + (d.x - 90) + '),translate(' + d.y + ')';
            });
        circle.exit()
            .transition()
            .duration(this.config.duration)
            .attr('r', 0)
            .attr('transform', () => {
                return 'rotate(' + (source.x - 90) + '),translate(' + source.y + ')';
            })
            .remove();
    }

    _updateLabels(nodes, source, maxValue, maxSumOfValues) {
        const data = nodes.filter((d) => {
            return d.depth < 2;
        });
        const label = d3.select('#labels')
            .selectAll('g')
            .data(data, (d) => {
                return d.id;
            })
        label.enter()
            .append('g')
            .attr('transform', (d) => {
                return 'rotate(' + (d.x - 90) + '),translate(' + d.y + '),rotate(' + (90 - d.x) + ')';
            })
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('font-family', 'arial, sans-serif')
            .attr('font-size', (d) => {
                const value = this.config.displayRounds ?
                    d.value :
                    d3.sum(d.values);
                const max = this.config.displayRounds ?
                    maxValue[d.depth] :
                    maxSumOfValues[d.depth];
                const size = (value / max * 10 || 0) + 10;
                return size;
            })
            .attr('y', (d) => {
                const value = this.config.displayRounds ?
                    d.value :
                    d3.sum(d.values);
                const max = this.config.displayRounds ?
                    maxValue[d.depth] :
                    maxSumOfValues[d.depth];
                const size = (value / max * 10 + 5 || 0) + 10;
                return - size / 2;
            })
            .attr('fill', '#555')
            .text((d) => {
                return d.name
                    .replace(/ \[.*\]/, '')
                    .split(', ')[0];
            });
        label
            .transition()
            .duration(this.config.duration)
            .attr('transform', (d) => {
                return 'rotate(' + (d.x - 90) + '),translate(' + d.y + '),rotate(' + (90 - d.x) + ')';
            });
        label.exit()
            .transition()
            .duration(this.config.duration)
            .remove();
        label.selectAll('text')
            .call(d3.behavior.drag()
                .on('dragstart', () => {
        	    	d3.event.sourceEvent.stopPropagation();
        	    })
                .on('drag', function(d) {
                    d3.select(this)
                        .attr('y', 0)
                        .attr('transform', 'translate(' + d3.event.x + ',' + d3.event.y + ')');
                })
            );
    }


    search(word) {
        const node = d3.select('#nodes')
            .selectAll('circle');
        const hits = node
            .filter((d) => {
                return d.entry === word;
            });
        hits.style('fill', '#f00')
            .style('opacity', 0.5)
            .transition()
            .duration(1000)
            .style('r', 50)
            .style('stroke-width', 0)
            .style('opacity', 0)
            .each('end', function() {
                d3.select(this)
                    .attr('style', null);
            });
        if (!hits[0].length) {
            alert('No results found: ' + word);
        }
    }


    getNodes(node=this.root, nodes=[], depth=0) {
        node.depth = depth;
        nodes.push(node);
        for (const node of (node.children || node._children || [])) {
            this.getNodes(node, nodes, depth + 1);
        }
        return nodes;
    }

    _collapseChildren(node) {
        if (node.children) {
            node._children = node.children;
            node.children = null;
        } else if (node._children) {
            node.children = node._children;
            node._children = null;
        }
    }

    _highlightLinks(node) {
        d3.selectAll('path')
            .filter((d) => {
                if (d.target.id === node.id) {
                    return true;
                }
            })
            .style('stroke', (d) => {
                const n = d.target.depth % this.config.color.class.length;
                return this.config.color.class[n];
            })
            .style('stroke-width', 1.5);
        if (node.parent) {
            this._highlightLinks(node.parent);
        }
    }
}
