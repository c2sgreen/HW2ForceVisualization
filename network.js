function simulate(data, svg) {
    const width = +svg.attr("viewBox").split(" ")[2];
    const height = +svg.attr("viewBox").split(" ")[3];

    const main_group = svg.append("g");

    const graph_group = main_group.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // Count each author's distinct coauthors.
    const node_degree = Object.fromEntries(
        data.nodes.map(d => [d.id, 0])
    );

    data.links.forEach(d => {
        node_degree[d.source]++;
        node_degree[d.target]++;
    });

    // Required square-root radius scale.
    const scale_radius = d3.scaleSqrt()
        .domain([0, d3.max(Object.values(node_degree)) || 1])
        .range([3, 12]);

    // Find the top 10 countries by author count.
    const countryCounts = d3.rollups(
        data.nodes.filter(d =>
            d.country && d.country !== "Unknown"
        ),
        nodes => nodes.length,
        d => d.country
    );

    const topCountries = countryCounts
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(d => d[0]);

    const color = d3.scaleOrdinal()
        .domain(topCountries)
        .range(d3.schemeCategory10)
        .unknown("#A9A9A9");

    // Build the country legend.
    const legend = d3.select("#legend");
    legend.selectAll("*").remove();

    const legendData = topCountries.map(country => ({
        label: country,
        color: color(country)
    }));

    legendData.push({
        label: "Other / Unknown",
        color: "#A9A9A9"
    });

    const legendItems = legend.selectAll(".legend-item")
        .data(legendData)
        .join("div")
        .attr("class", "legend-item");

    legendItems.append("span")
        .attr("class", "legend-swatch")
        .style("background-color", d => d.color);

    legendItems.append("span")
        .text(d => d.label);

    // Links: width represents shared publication count.
    const link_elements = graph_group.append("g")
        .selectAll("line")
        .data(data.links)
        .join("line")
        .attr("stroke-width", d =>
            Math.min(3, Math.sqrt(d.value ?? 1))
        );

    const tooltip = d3.select("#tooltip");

    const node_elements = graph_group.append("g")
        .selectAll(".node")
        .data(data.nodes)
        .join("g")
        .attr("class", "node")

        // Keep authors with matching affiliations at full opacity.
        .on("mouseenter", function (event, hoveredNode) {
            node_elements.classed("inactive", d =>
                d.id !== hoveredNode.id &&
                (
                    !hoveredNode.affiliation ||
                    d.affiliation !== hoveredNode.affiliation
                )
            );
        })

        .on("mouseleave", function () {
            node_elements.classed("inactive", false);
        })

        // Show author information in the required tooltip div.
        .on("click", function (event, d) {
            event.stopPropagation();

            tooltip.selectAll("*").remove();

            tooltip.append("strong")
                .text(d.name ?? d.id);

            tooltip.append("div")
                .text(`Affiliation: ${d.affiliation || "Unknown"}`);

            tooltip.append("div")
                .text(`Country: ${d.country || "Unknown"}`);

            tooltip.append("div")
                .text(`Coauthors: ${node_degree[d.id]}`);

            tooltip.attr("hidden", null);

            const box = tooltip.node().getBoundingClientRect();

            const left = Math.max(
                8,
                Math.min(
                    event.clientX + 12,
                    window.innerWidth - box.width - 8
                )
            );

            const top = Math.max(
                8,
                Math.min(
                    event.clientY + 12,
                    window.innerHeight - box.height - 8
                )
            );

            tooltip
                .style("left", `${left}px`)
                .style("top", `${top}px`);
        });

    node_elements.append("circle")
        .attr("r", d => scale_radius(node_degree[d.id]))
        .attr("fill", d => color(d.country));

    // Click the graph background to close the tooltip.
    svg.on("click.tooltip", function () {
        tooltip.attr("hidden", true);
    });

    // Read initial force settings from the sliders.
    const chargeForce = d3.forceManyBody()
        .strength(+d3.select("#charge").property("value"));

    const collisionForce = d3.forceCollide()
        .radius(d =>
            scale_radius(node_degree[d.id]) *
            +d3.select("#collision").property("value")
        );

    const linkForce = d3.forceLink(data.links)
        .id(d => d.id)
        .distance(60)
        .strength(
            +d3.select("#link-strength").property("value")
        );

    const simulation = d3.forceSimulation(data.nodes)
        .force("collide", collisionForce)
        .force("charge", chargeForce)
        .force("link", linkForce)
        .force("x", d3.forceX(0).strength(0.02))
        .force("y", d3.forceY(0).strength(0.02))
        .on("tick", ticked);

    function ticked() {
        node_elements.attr(
            "transform",
            d => `translate(${d.x},${d.y})`
        );

        link_elements
            .attr("x1", d => d.source.x)
            .attr("x2", d => d.target.x)
            .attr("y1", d => d.source.y)
            .attr("y2", d => d.target.y);
    }

    // Connect each slider to its force.
    d3.select("#charge").on("input", function () {
        const value = +this.value;

        d3.select("#charge-value").text(value);
        chargeForce.strength(value);
        simulation.alpha(0.5).restart();
    });

    d3.select("#collision").on("input", function () {
        const value = +this.value;

        d3.select("#collision-value").text(value);

        collisionForce.radius(d =>
            scale_radius(node_degree[d.id]) * value
        );

        simulation.alpha(0.5).restart();
    });

    d3.select("#link-strength").on("input", function () {
        const value = +this.value;

        d3.select("#link-strength-value").text(value);
        linkForce.strength(value);
        simulation.alpha(0.5).restart();
    });

    svg.call(
        d3.zoom()
            .extent([[0, 0], [width, height]])
            .scaleExtent([0.1, 8])
            .on("zoom", function ({ transform }) {
                main_group.attr("transform", transform);
            })
    );
}