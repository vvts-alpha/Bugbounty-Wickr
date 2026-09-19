/**
 * Adapted from: https://github.com/g21589/PPTX2HTML (MIT License)
 */
import JSZip from 'jszip';
import * as colz from 'colz';
import 'highlight.js';
import { XMLParser } from 'fast-xml-parser';

const MIN_FONT_SIZE = 12;

var MsgQueue = new Array();

var themeContent = null;

var chartID = 0;

var styleTable = {};

self.onmessage = async function (e) {
  try {
    switch (e.data.type) {
      case 'processPPTX':
        await processPPTX(e.data.data);
        break;
      case 'getMsgQueue':
        self.postMessage({
          type: 'processMsgQueue',
          data: MsgQueue,
        });
        break;
      default:
    }
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      data: err,
    });
  }
};

async function processPPTX(data) {
  var dateBefore = Date.now();

  const zip = await JSZip.loadAsync(data);

  if (zip.file('docProps/thumbnail.jpeg') !== null) {
    var pptxThumbImg = base64ArrayBuffer(
      await zip.file('docProps/thumbnail.jpeg').async('arraybuffer')
    );
    self.postMessage({
      type: 'pptx-thumb',
      data: pptxThumbImg,
    });
  }

  var filesInfo = await getContentTypes(zip);
  var slideSize = await getSlideSize(zip);
  themeContent = await loadTheme(zip);

  self.postMessage({
    type: 'slideSize',
    data: slideSize,
  });

  var numOfSlides = filesInfo['slides'].length;
  for (var i = 0; i < numOfSlides; i++) {
    var filename = filesInfo['slides'][i];
    var slideHtml = await processSingleSlide(zip, filename, i, slideSize);
    self.postMessage({
      type: 'slide',
      data: slideHtml,
    });
    self.postMessage({
      type: 'progress-update',
      data: ((i + 1) * 100) / numOfSlides,
    });
  }

  self.postMessage({
    type: 'globalCSS',
    data: genGlobalCSS(),
  });

  var dateAfter = Date.now();
  self.postMessage({
    type: 'complete',
    data: dateAfter - dateBefore,
  });
}

async function readXmlFile(zip, filename) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const text = await zip.file(filename).async('text');
  return parser.parse(text, true);
}

async function getContentTypes(zip) {
  var ContentTypesJson = await readXmlFile(zip, '[Content_Types].xml');
  var subObj = ContentTypesJson['Types']['Override'];
  var slidesLocArray = [];
  var slideLayoutsLocArray = [];
  for (var i = 0; i < subObj.length; i++) {
    switch (subObj[i]['@_ContentType']) {
      case 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml':
        slidesLocArray.push(subObj[i]['@_PartName'].substr(1));
        break;
      case 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml':
        slideLayoutsLocArray.push(subObj[i]['@_PartName'].substr(1));
        break;
      default:
    }
  }
  return {
    slides: slidesLocArray,
    slideLayouts: slideLayoutsLocArray,
  };
}

async function getSlideSize(zip) {
  // Pixel = EMUs * Resolution / 914400;  (Resolution = 96)
  var content = await readXmlFile(zip, 'ppt/presentation.xml');
  var sldSz = content['p:presentation']['p:sldSz'];
  return {
    width: (parseInt(sldSz['@_cx']) * 96) / 914400,
    height: (parseInt(sldSz['@_cy']) * 96) / 914400,
  };
}

async function loadTheme(zip) {
  var preResContent = await readXmlFile(zip, 'ppt/_rels/presentation.xml.rels');
  var relationshipArray = preResContent['Relationships']['Relationship'];
  var themeURI = undefined;
  if (relationshipArray.constructor === Array) {
    for (var i = 0; i < relationshipArray.length; i++) {
      if (
        relationshipArray[i]['@_Type'] ===
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme'
      ) {
        themeURI = relationshipArray[i]['@_Target'];
        break;
      }
    }
  } else if (
    relationshipArray['@_Type'] ===
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme'
  ) {
    themeURI = relationshipArray['@_Target'];
  }

  if (themeURI === undefined) {
    throw Error("Can't open theme file.");
  }

  return await readXmlFile(zip, 'ppt/' + themeURI);
}

async function processSingleSlide(zip, sldFileName, index, slideSize) {
  self.postMessage({
    type: 'INFO',
    data: 'Processing slide #' + (index + 1),
  });

  // =====< Step 1 >=====
  // Read relationship filename of the slide (Get slideLayoutXX.xml)
  // @sldFileName: ppt/slides/slide1.xml
  // @resName: ppt/slides/_rels/slide1.xml.rels
  var resName = sldFileName.replace('slides/slide', 'slides/_rels/slide') + '.rels';
  var resContent = await readXmlFile(zip, resName);
  var RelationshipArray = resContent['Relationships']['Relationship'];
  var layoutFilename = '';
  var slideResObj = {};
  if (RelationshipArray.constructor === Array) {
    for (var i = 0; i < RelationshipArray.length; i++) {
      switch (RelationshipArray[i]['@_Type']) {
        case 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout':
          layoutFilename = RelationshipArray[i]['@_Target'].replace('../', 'ppt/');
          break;
        case 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide':
        case 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image':
        case 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart':
        case 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink':
        default:
          slideResObj[RelationshipArray[i]['@_Id']] = {
            type: RelationshipArray[i]['@_Type'].replace(
              'http://schemas.openxmlformats.org/officeDocument/2006/relationships/',
              ''
            ),
            target: RelationshipArray[i]['@_Target'].replace('../', 'ppt/'),
          };
      }
    }
  } else {
    layoutFilename = RelationshipArray['@_Target'].replace('../', 'ppt/');
  }

  // Open slideLayoutXX.xml
  var slideLayoutContent = await readXmlFile(zip, layoutFilename);
  var slideLayoutTables = indexNodes(slideLayoutContent);
  //debug(slideLayoutTables);

  // =====< Step 2 >=====
  // Read slide master filename of the slidelayout (Get slideMasterXX.xml)
  // @resName: ppt/slideLayouts/slideLayout1.xml
  // @masterName: ppt/slideLayouts/_rels/slideLayout1.xml.rels
  var slideLayoutResFilename =
    layoutFilename.replace('slideLayouts/slideLayout', 'slideLayouts/_rels/slideLayout') + '.rels';
  var slideLayoutResContent = await readXmlFile(zip, slideLayoutResFilename);
  RelationshipArray = slideLayoutResContent['Relationships']['Relationship'];
  var masterFilename = '';
  if (RelationshipArray.constructor === Array) {
    for (var i = 0; i < RelationshipArray.length; i++) {
      switch (RelationshipArray[i]['@_Type']) {
        case 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster':
          masterFilename = RelationshipArray[i]['@_Target'].replace('../', 'ppt/');
          break;
        default:
      }
    }
  } else {
    masterFilename = RelationshipArray['@_Target'].replace('../', 'ppt/');
  }
  // Open slideMasterXX.xml
  var slideMasterContent = await readXmlFile(zip, masterFilename);
  var slideMasterTextStyles = getTextByPathList(slideMasterContent, ['p:sldMaster', 'p:txStyles']);
  var slideMasterTables = indexNodes(slideMasterContent);
  //debug(slideMasterTables);

  // =====< Step 3 >=====
  var slideContent = await readXmlFile(zip, sldFileName);
  var nodes = slideContent['p:sld']['p:cSld']['p:spTree'];
  var warpObj = {
    zip: zip,
    slideLayoutTables: slideLayoutTables,
    slideMasterTables: slideMasterTables,
    slideResObj: slideResObj,
    slideMasterTextStyles: slideMasterTextStyles,
  };

  var bgColor = getSlideBackgroundFill(slideContent, slideLayoutContent, slideMasterContent);

  var result =
    "<section style='width:" +
    slideSize.width +
    'px; height:' +
    slideSize.height +
    'px; background-color: #' +
    bgColor +
    "'>";

  for (var nodeKey in nodes) {
    if (nodes[nodeKey].constructor === Array) {
      for (var i = 0; i < nodes[nodeKey].length; i++) {
        result += await processNodesInSlide(nodeKey, nodes[nodeKey][i], warpObj);
      }
    } else {
      result += await processNodesInSlide(nodeKey, nodes[nodeKey], warpObj);
    }
  }

  return result + '</section>';
}

function indexNodes(content) {
  var keys = Object.keys(content);
  var spTreeNode = content[keys[1]]['p:cSld']['p:spTree'];

  var idTable = {};
  var idxTable = {};
  var typeTable = {};

  for (var key in spTreeNode) {
    if (key == 'p:nvGrpSpPr' || key == 'p:grpSpPr') {
      continue;
    }

    var targetNode = spTreeNode[key];

    if (targetNode.constructor === Array) {
      for (var i = 0; i < targetNode.length; i++) {
        var nvSpPrNode = targetNode[i]['p:nvSpPr'];
        var id = getTextByPathList(nvSpPrNode, ['p:cNvPr', '@_id']);
        var idx = getTextByPathList(nvSpPrNode, ['p:nvPr', 'p:ph', '@_idx']);
        var type = getTextByPathList(nvSpPrNode, ['p:nvPr', 'p:ph', '@_type']);

        if (id !== undefined) {
          idTable[id] = targetNode[i];
        }
        if (idx !== undefined) {
          idxTable[idx] = targetNode[i];
        }
        if (type !== undefined) {
          typeTable[type] = targetNode[i];
        }
      }
    } else {
      var nvSpPrNode = targetNode['p:nvSpPr'];
      var id = getTextByPathList(nvSpPrNode, ['p:cNvPr', '@_id']);
      var idx = getTextByPathList(nvSpPrNode, ['p:nvPr', 'p:ph', '@_idx']);
      var type = getTextByPathList(nvSpPrNode, ['p:nvPr', 'p:ph', '@_type']);

      if (id !== undefined) {
        idTable[id] = targetNode;
      }
      if (idx !== undefined) {
        idxTable[idx] = targetNode;
      }
      if (type !== undefined) {
        typeTable[type] = targetNode;
      }
    }
  }

  return { idTable: idTable, idxTable: idxTable, typeTable: typeTable };
}

async function processNodesInSlide(nodeKey, nodeValue, warpObj) {
  var result = '';

  switch (nodeKey) {
    case 'p:sp': // Shape, Text
      result = await processSpNode(nodeValue, warpObj);
      break;
    case 'p:cxnSp': // Shape, Text (with connection)
      result = await processCxnSpNode(nodeValue, warpObj);
      break;
    case 'p:pic': // Picture
      result = await processPicNode(nodeValue, warpObj);
      break;
    case 'p:graphicFrame': // Chart, Diagram, Table
      result = await processGraphicFrameNode(nodeValue, warpObj);
      break;
    case 'p:grpSp': // 群組
      result = await processGroupSpNode(nodeValue, warpObj);
      break;
    default:
  }

  return result;
}

async function processGroupSpNode(node, warpObj) {
  var factor = 96 / 914400;

  var xfrmNode = node['p:grpSpPr']['a:xfrm'];
  var x = parseInt(xfrmNode['a:off']['@_x']) * factor;
  var y = parseInt(xfrmNode['a:off']['@_y']) * factor;
  var chx = parseInt(xfrmNode['a:chOff']['@_x']) * factor;
  var chy = parseInt(xfrmNode['a:chOff']['@_y']) * factor;
  var cx = parseInt(xfrmNode['a:ext']['@_cx']) * factor;
  var cy = parseInt(xfrmNode['a:ext']['@_cy']) * factor;
  var chcx = parseInt(xfrmNode['a:chExt']['@_cx']) * factor;
  var chcy = parseInt(xfrmNode['a:chExt']['@_cy']) * factor;

  var order = node['@_order'];

  var result =
    "<div class='block group' style='z-index: " +
    order +
    '; top: ' +
    (y - chy) +
    'px; left: ' +
    (x - chx) +
    'px; width: ' +
    (cx - chcx) +
    'px; height: ' +
    (cy - chcy) +
    "px;'>";

  // Procsee all child nodes
  for (var nodeKey in node) {
    if (node[nodeKey].constructor === Array) {
      for (var i = 0; i < node[nodeKey].length; i++) {
        result += await processNodesInSlide(nodeKey, node[nodeKey][i], warpObj);
      }
    } else {
      result += await processNodesInSlide(nodeKey, node[nodeKey], warpObj);
    }
  }

  result += '</div>';

  return result;
}

function processSpNode(node, warpObj) {
  /*
   *  958    <xsd:complexType name="CT_GvmlShape">
   *  959   <xsd:sequence>
   *  960     <xsd:element name="nvSpPr" type="CT_GvmlShapeNonVisual"     minOccurs="1" maxOccurs="1"/>
   *  961     <xsd:element name="spPr"   type="CT_ShapeProperties"        minOccurs="1" maxOccurs="1"/>
   *  962     <xsd:element name="txSp"   type="CT_GvmlTextShape"          minOccurs="0" maxOccurs="1"/>
   *  963     <xsd:element name="style"  type="CT_ShapeStyle"             minOccurs="0" maxOccurs="1"/>
   *  964     <xsd:element name="extLst" type="CT_OfficeArtExtensionList" minOccurs="0" maxOccurs="1"/>
   *  965   </xsd:sequence>
   *  966 </xsd:complexType>
   */

  var id = node['p:nvSpPr']['p:cNvPr']['@_id'];
  var name = node['p:nvSpPr']['p:cNvPr']['@_name'];
  var idx =
    node['p:nvSpPr']['p:nvPr']['p:ph'] === undefined
      ? undefined
      : node['p:nvSpPr']['p:nvPr']['p:ph']['@_idx'];
  var type =
    node['p:nvSpPr']['p:nvPr']['p:ph'] === undefined
      ? undefined
      : node['p:nvSpPr']['p:nvPr']['p:ph']['@_type'];
  var order = node['@_order'];

  var slideLayoutSpNode = undefined;
  var slideMasterSpNode = undefined;

  if (type !== undefined) {
    if (idx !== undefined) {
      slideLayoutSpNode = warpObj['slideLayoutTables']['typeTable'][type];
      slideMasterSpNode = warpObj['slideMasterTables']['typeTable'][type];
    } else {
      slideLayoutSpNode = warpObj['slideLayoutTables']['typeTable'][type];
      slideMasterSpNode = warpObj['slideMasterTables']['typeTable'][type];
    }
  } else {
    if (idx !== undefined) {
      slideLayoutSpNode = warpObj['slideLayoutTables']['idxTable'][idx];
      slideMasterSpNode = warpObj['slideMasterTables']['idxTable'][idx];
    } else {
      // Nothing
    }
  }

  if (type === undefined) {
    type = getTextByPathList(slideLayoutSpNode, ['p:nvSpPr', 'p:nvPr', 'p:ph', '@_type']);
    if (type === undefined) {
      type = getTextByPathList(slideMasterSpNode, ['p:nvSpPr', 'p:nvPr', 'p:ph', '@_type']);
    }
  }

  debug({ id: id, name: name, idx: idx, type: type, order: order });
  //debug( JSON.stringify( node ) );

  return genShape(node, slideLayoutSpNode, slideMasterSpNode, id, name, idx, type, order, warpObj);
}

function processCxnSpNode(node, warpObj) {
  var id = node['p:nvCxnSpPr']['p:cNvPr']['@_id'];
  var name = node['p:nvCxnSpPr']['p:cNvPr']['@_name'];
  //var idx = (node["p:nvCxnSpPr"]["p:nvPr"]["p:ph"] === undefined) ? undefined : node["p:nvSpPr"]["p:nvPr"]["p:ph"]["@_idx"];
  //var type = (node["p:nvCxnSpPr"]["p:nvPr"]["p:ph"] === undefined) ? undefined : node["p:nvSpPr"]["p:nvPr"]["p:ph"]["@_type"];
  //<p:cNvCxnSpPr>(<p:cNvCxnSpPr>, <a:endCxn>)
  var order = node['@_order'];

  debug({ id: id, name: name, order: order });

  return genShape(node, undefined, undefined, id, name, undefined, undefined, order, warpObj);
}

function genShape(node, slideLayoutSpNode, slideMasterSpNode, id, name, idx, type, order, warpObj) {
  var xfrmList = ['p:spPr', 'a:xfrm'];
  var slideXfrmNode = getTextByPathList(node, xfrmList);
  var slideLayoutXfrmNode = getTextByPathList(slideLayoutSpNode, xfrmList);
  var slideMasterXfrmNode = getTextByPathList(slideMasterSpNode, xfrmList);

  var result = '';
  var shapType = getTextByPathList(node, ['p:spPr', 'a:prstGeom', '@_prst']);

  var isFlipV = false;
  if (
    getTextByPathList(slideXfrmNode, ['@_flipV']) === '1' ||
    getTextByPathList(slideXfrmNode, ['@_flipH']) === '1'
  ) {
    isFlipV = true;
  }

  if (shapType !== undefined) {
    var off = getTextByPathList(slideXfrmNode, ['a:off']);
    var x = (parseInt(off['@_x']) * 96) / 914400;
    var y = (parseInt(off['@_y']) * 96) / 914400;

    var ext = getTextByPathList(slideXfrmNode, ['a:ext']);
    var w = (parseInt(ext['@_cx']) * 96) / 914400;
    var h = (parseInt(ext['@_cy']) * 96) / 914400;

    result +=
      "<svg class='drawing' _id='" +
      id +
      "' _idx='" +
      idx +
      "' _type='" +
      type +
      "' _name='" +
      name +
      "' style='" +
      getPosition(slideXfrmNode, undefined, undefined) +
      getSize(slideXfrmNode, undefined, undefined) +
      ' z-index: ' +
      order +
      ';' +
      "'>";

    // Fill Color
    var fillColor = getShapeFill(node, true);

    // Border Color
    var border = getBorder(node, true);

    var headEndNode = getTextByPathList(node, ['p:spPr', 'a:ln', 'a:headEnd']);
    var tailEndNode = getTextByPathList(node, ['p:spPr', 'a:ln', 'a:tailEnd']);
    // type: none, triangle, stealth, diamond, oval, arrow
    if (
      (headEndNode !== undefined &&
        (headEndNode['@_type'] === 'triangle' || headEndNode['@_type'] === 'arrow')) ||
      (tailEndNode !== undefined &&
        (tailEndNode['@_type'] === 'triangle' || tailEndNode['@_type'] === 'arrow'))
    ) {
      var triangleMarker =
        '<defs><marker id="markerTriangle" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>';
      result += triangleMarker;
    }

    switch (shapType) {
      case 'accentBorderCallout1':
      case 'accentBorderCallout2':
      case 'accentBorderCallout3':
      case 'accentCallout1':
      case 'accentCallout2':
      case 'accentCallout3':
      case 'actionButtonBackPrevious':
      case 'actionButtonBeginning':
      case 'actionButtonBlank':
      case 'actionButtonDocument':
      case 'actionButtonEnd':
      case 'actionButtonForwardNext':
      case 'actionButtonHelp':
      case 'actionButtonHome':
      case 'actionButtonInformation':
      case 'actionButtonMovie':
      case 'actionButtonReturn':
      case 'actionButtonSound':
      case 'arc':
      case 'bevel':
      case 'blockArc':
      case 'borderCallout1':
      case 'borderCallout2':
      case 'borderCallout3':
      case 'bracePair':
      case 'bracketPair':
      case 'callout1':
      case 'callout2':
      case 'callout3':
      case 'can':
      case 'chartPlus':
      case 'chartStar':
      case 'chartX':
      case 'chevron':
      case 'chord':
      case 'cloud':
      case 'cloudCallout':
      case 'corner':
      case 'cornerTabs':
      case 'cube':
      case 'decagon':
      case 'diagStripe':
      case 'diamond':
      case 'dodecagon':
      case 'donut':
      case 'doubleWave':
      case 'downArrowCallout':
      case 'ellipseRibbon':
      case 'ellipseRibbon2':
      case 'flowChartAlternateProcess':
      case 'flowChartCollate':
      case 'flowChartConnector':
      case 'flowChartDecision':
      case 'flowChartDelay':
      case 'flowChartDisplay':
      case 'flowChartDocument':
      case 'flowChartExtract':
      case 'flowChartInputOutput':
      case 'flowChartInternalStorage':
      case 'flowChartMagneticDisk':
      case 'flowChartMagneticDrum':
      case 'flowChartMagneticTape':
      case 'flowChartManualInput':
      case 'flowChartManualOperation':
      case 'flowChartMerge':
      case 'flowChartMultidocument':
      case 'flowChartOfflineStorage':
      case 'flowChartOffpageConnector':
      case 'flowChartOnlineStorage':
      case 'flowChartOr':
      case 'flowChartPredefinedProcess':
      case 'flowChartPreparation':
      case 'flowChartProcess':
      case 'flowChartPunchedCard':
      case 'flowChartPunchedTape':
      case 'flowChartSort':
      case 'flowChartSummingJunction':
      case 'flowChartTerminator':
      case 'folderCorner':
      case 'frame':
      case 'funnel':
      case 'gear6':
      case 'gear9':
      case 'halfFrame':
      case 'heart':
      case 'heptagon':
      case 'hexagon':
      case 'homePlate':
      case 'horizontalScroll':
      case 'irregularSeal1':
      case 'irregularSeal2':
      case 'leftArrow':
      case 'leftArrowCallout':
      case 'leftBrace':
      case 'leftBracket':
      case 'leftRightArrowCallout':
      case 'leftRightRibbon':
      case 'irregularSeal1':
      case 'lightningBolt':
      case 'lineInv':
      case 'mathDivide':
      case 'mathEqual':
      case 'mathMinus':
      case 'mathMultiply':
      case 'mathNotEqual':
      case 'mathPlus':
      case 'moon':
      case 'nonIsoscelesTrapezoid':
      case 'noSmoking':
      case 'octagon':
      case 'parallelogram':
      case 'pentagon':
      case 'pie':
      case 'pieWedge':
      case 'plaque':
      case 'plaqueTabs':
      case 'plus':
      case 'quadArrowCallout':
      case 'rect':
      case 'ribbon':
      case 'ribbon2':
      case 'rightArrowCallout':
      case 'rightBrace':
      case 'rightBracket':
      case 'round1Rect':
      case 'round2DiagRect':
      case 'round2SameRect':
      case 'rtTriangle':
      case 'smileyFace':
      case 'snip1Rect':
      case 'snip2DiagRect':
      case 'snip2SameRect':
      case 'snipRoundRect':
      case 'squareTabs':
      case 'star10':
      case 'star12':
      case 'star16':
      case 'star24':
      case 'star32':
      case 'star4':
      case 'star5':
      case 'star6':
      case 'star7':
      case 'star8':
      case 'sun':
      case 'teardrop':
      case 'trapezoid':
      case 'upArrowCallout':
      case 'upDownArrowCallout':
      case 'verticalScroll':
      case 'wave':
      case 'wedgeEllipseCallout':
      case 'wedgeRectCallout':
      case 'wedgeRoundRectCallout':
      case 'rect':
        result +=
          "<rect x='0' y='0' width='" +
          w +
          "' height='" +
          h +
          "' fill='" +
          fillColor +
          "' stroke='" +
          border.color +
          "' stroke-width='" +
          border.width +
          "' stroke-dasharray='" +
          border.strokeDasharray +
          "' />";
        break;
      case 'ellipse':
        result +=
          "<ellipse cx='" +
          w / 2 +
          "' cy='" +
          h / 2 +
          "' rx='" +
          w / 2 +
          "' ry='" +
          h / 2 +
          "' fill='" +
          fillColor +
          "' stroke='" +
          border.color +
          "' stroke-width='" +
          border.width +
          "' stroke-dasharray='" +
          border.strokeDasharray +
          "' />";
        break;
      case 'roundRect':
        result +=
          "<rect x='0' y='0' width='" +
          w +
          "' height='" +
          h +
          "' rx='7' ry='7' fill='" +
          fillColor +
          "' stroke='" +
          border.color +
          "' stroke-width='" +
          border.width +
          "' stroke-dasharray='" +
          border.strokeDasharray +
          "' />";
        break;
      case 'bentConnector2': // 直角 (path)
        var d = '';
        if (isFlipV) {
          d = 'M 0 ' + w + ' L ' + h + ' ' + w + ' L ' + h + ' 0';
        } else {
          d = 'M ' + w + ' 0 L ' + w + ' ' + h + ' L 0 ' + h;
        }
        result +=
          "<path d='" +
          d +
          "' stroke='" +
          border.color +
          "' stroke-width='" +
          border.width +
          "' stroke-dasharray='" +
          border.strokeDasharray +
          "' fill='none' ";
        if (
          headEndNode !== undefined &&
          (headEndNode['type'] === 'triangle' || headEndNode['type'] === 'arrow')
        ) {
          result += "marker-start='url(#markerTriangle)' ";
        }
        if (
          tailEndNode !== undefined &&
          (tailEndNode['type'] === 'triangle' || tailEndNode['type'] === 'arrow')
        ) {
          result += "marker-end='url(#markerTriangle)' ";
        }
        result += '/>';
        break;
      case 'line':
      case 'straightConnector1':
      case 'bentConnector3':
      case 'bentConnector4':
      case 'bentConnector5':
      case 'curvedConnector2':
      case 'curvedConnector3':
      case 'curvedConnector4':
      case 'curvedConnector5':
        if (isFlipV) {
          result +=
            "<line x1='" +
            w +
            "' y1='0' x2='0' y2='" +
            h +
            "' stroke='" +
            border.color +
            "' stroke-width='" +
            border.width +
            "' stroke-dasharray='" +
            border.strokeDasharray +
            "' ";
        } else {
          result +=
            "<line x1='0' y1='0' x2='" +
            w +
            "' y2='" +
            h +
            "' stroke='" +
            border.color +
            "' stroke-width='" +
            border.width +
            "' stroke-dasharray='" +
            border.strokeDasharray +
            "' ";
        }
        if (
          headEndNode !== undefined &&
          (headEndNode['type'] === 'triangle' || headEndNode['type'] === 'arrow')
        ) {
          result += "marker-start='url(#markerTriangle)' ";
        }
        if (
          tailEndNode !== undefined &&
          (tailEndNode['type'] === 'triangle' || tailEndNode['type'] === 'arrow')
        ) {
          result += "marker-end='url(#markerTriangle)' ";
        }
        result += '/>';
        break;
      case 'rightArrow':
        result +=
          '<defs><marker id="markerTriangle" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="2.5" markerHeight="2.5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>';
        result +=
          "<line x1='0' y1='" +
          h / 2 +
          "' x2='" +
          (w - 15) +
          "' y2='" +
          h / 2 +
          "' stroke='" +
          border.color +
          "' stroke-width='" +
          h / 2 +
          "' stroke-dasharray='" +
          border.strokeDasharray +
          "' ";
        result += "marker-end='url(#markerTriangle)' />";
        break;
      case 'downArrow':
        result +=
          '<defs><marker id="markerTriangle" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="2.5" markerHeight="2.5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>';
        result +=
          "<line x1='" +
          w / 2 +
          "' y1='0' x2='" +
          w / 2 +
          "' y2='" +
          (h - 15) +
          "' stroke='" +
          border.color +
          "' stroke-width='" +
          w / 2 +
          "' stroke-dasharray='" +
          border.strokeDasharray +
          "' ";
        result += "marker-end='url(#markerTriangle)' />";
        break;
      case 'bentArrow':
      case 'bentUpArrow':
      case 'stripedRightArrow':
      case 'quadArrow':
      case 'circularArrow':
      case 'swooshArrow':
      case 'leftRightArrow':
      case 'leftRightUpArrow':
      case 'leftUpArrow':
      case 'leftCircularArrow':
      case 'notchedRightArrow':
      case 'curvedDownArrow':
      case 'curvedLeftArrow':
      case 'curvedRightArrow':
      case 'curvedUpArrow':
      case 'upDownArrow':
      case 'upArrow':
      case 'uturnArrow':
      case 'leftRightCircularArrow':
        break;
      case 'triangle':
        break;
      case undefined:
      default:
        console.warn('Undefine shape type.');
    }

    result += '</svg>';

    result +=
      "<div class='block content " +
      getVerticalAlign(node, slideLayoutSpNode, slideMasterSpNode, type) +
      "' _id='" +
      id +
      "' _idx='" +
      idx +
      "' _type='" +
      type +
      "' _name='" +
      name +
      "' style='" +
      getPosition(slideXfrmNode, slideLayoutXfrmNode, slideMasterXfrmNode) +
      getSize(slideXfrmNode, slideLayoutXfrmNode, slideMasterXfrmNode) +
      ' z-index: ' +
      order +
      ';' +
      "'>";

    // TextBody
    if (node['p:txBody'] !== undefined) {
      result += genTextBody(node['p:txBody'], slideLayoutSpNode, slideMasterSpNode, type, warpObj);
    }
    result += '</div>';
  } else {
    result +=
      "<div class='block content " +
      getVerticalAlign(node, slideLayoutSpNode, slideMasterSpNode, type) +
      "' _id='" +
      id +
      "' _idx='" +
      idx +
      "' _type='" +
      type +
      "' _name='" +
      name +
      "' style='" +
      getPosition(slideXfrmNode, slideLayoutXfrmNode, slideMasterXfrmNode) +
      getSize(slideXfrmNode, slideLayoutXfrmNode, slideMasterXfrmNode) +
      getBorder(node, false) +
      getShapeFill(node, false) +
      ' z-index: ' +
      order +
      ';' +
      "'>";

    // TextBody
    if (node['p:txBody'] !== undefined) {
      result += genTextBody(node['p:txBody'], slideLayoutSpNode, slideMasterSpNode, type, warpObj);
    }
    result += '</div>';
  }

  return result;
}

async function processPicNode(node, warpObj) {
  //debug( JSON.stringify( node ) );

  var order = node['@_order'];

  var rid = node['p:blipFill']['a:blip']['@_r:embed'];
  var imgName = warpObj['slideResObj'][rid]['target'];
  var imgFileExt = extractFileExtension(imgName).toLowerCase();
  var zip = warpObj['zip'];
  var imgArrayBuffer = await zip.file(imgName).async('arraybuffer');
  var mimeType = '';
  var xfrmNode = node['p:spPr']['a:xfrm'];
  switch (imgFileExt) {
    case 'jpg':
    case 'jpeg':
      mimeType = 'image/jpeg';
      break;
    case 'png':
      mimeType = 'image/png';
      break;
    case 'gif':
      mimeType = 'image/gif';
      break;
    case 'emf': // Not native support
      mimeType = 'image/x-emf';
      break;
    case 'wmf': // Not native support
      mimeType = 'image/x-wmf';
      break;
    default:
      mimeType = 'image/*';
  }
  return (
    "<div class='block content' style='" +
    getPosition(xfrmNode, undefined, undefined) +
    getSize(xfrmNode, undefined, undefined) +
    ' z-index: ' +
    order +
    ';' +
    '\'><img src="data:' +
    mimeType +
    ';base64,' +
    base64ArrayBuffer(imgArrayBuffer) +
    "\" style='width: 100%; height: 100%'/></div>"
  );
}

async function processGraphicFrameNode(node, warpObj) {
  var result = '';
  var graphicTypeUri = getTextByPathList(node, ['a:graphic', 'a:graphicData', '@_uri']);

  switch (graphicTypeUri) {
    case 'http://schemas.openxmlformats.org/drawingml/2006/table':
      result = genTable(node, warpObj);
      break;
    case 'http://schemas.openxmlformats.org/drawingml/2006/chart':
      result = await genChart(node, warpObj);
      break;
    case 'http://schemas.openxmlformats.org/drawingml/2006/diagram':
      result = genDiagram(node, warpObj);
      break;
    default:
  }

  return result;
}

function processSpPrNode(node, warpObj) {
  /*
   * 2241 <xsd:complexType name="CT_ShapeProperties">
   * 2242   <xsd:sequence>
   * 2243     <xsd:element name="xfrm" type="CT_Transform2D"  minOccurs="0" maxOccurs="1"/>
   * 2244     <xsd:group   ref="EG_Geometry"                  minOccurs="0" maxOccurs="1"/>
   * 2245     <xsd:group   ref="EG_FillProperties"            minOccurs="0" maxOccurs="1"/>
   * 2246     <xsd:element name="ln" type="CT_LineProperties" minOccurs="0" maxOccurs="1"/>
   * 2247     <xsd:group   ref="EG_EffectProperties"          minOccurs="0" maxOccurs="1"/>
   * 2248     <xsd:element name="scene3d" type="CT_Scene3D"   minOccurs="0" maxOccurs="1"/>
   * 2249     <xsd:element name="sp3d" type="CT_Shape3D"      minOccurs="0" maxOccurs="1"/>
   * 2250     <xsd:element name="extLst" type="CT_OfficeArtExtensionList" minOccurs="0" maxOccurs="1"/>
   * 2251   </xsd:sequence>
   * 2252   <xsd:attribute name="bwMode" type="ST_BlackWhiteMode" use="optional"/>
   * 2253 </xsd:complexType>
   */
  // TODO:
}

function genTextBody(textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, warpObj) {
  var text = '';
  var slideMasterTextStyles = warpObj['slideMasterTextStyles'];

  if (textBodyNode === undefined) {
    return text;
  }

  if (textBodyNode['a:p'].constructor === Array) {
    // multi p
    for (var i = 0; i < textBodyNode['a:p'].length; i++) {
      var pNode = textBodyNode['a:p'][i];
      var rNode = pNode['a:r'];
      text +=
        "<div class='" +
        getHorizontalAlign(
          pNode,
          slideLayoutSpNode,
          slideMasterSpNode,
          type,
          slideMasterTextStyles
        ) +
        "'>";
      text += genBuChar(pNode);
      if (rNode === undefined) {
        // without r
        text += genSpanElement(pNode, slideLayoutSpNode, slideMasterSpNode, type, warpObj);
      } else if (rNode.constructor === Array) {
        // with multi r
        for (var j = 0; j < rNode.length; j++) {
          text += genSpanElement(rNode[j], slideLayoutSpNode, slideMasterSpNode, type, warpObj);
        }
      } else {
        // with one r
        text += genSpanElement(rNode, slideLayoutSpNode, slideMasterSpNode, type, warpObj);
      }
      text += '</div>';
    }
  } else {
    // one p
    var pNode = textBodyNode['a:p'];
    var rNode = pNode['a:r'];
    text +=
      "<div class='" +
      getHorizontalAlign(pNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles) +
      "'>";
    text += genBuChar(pNode);
    if (rNode === undefined) {
      // without r
      text += genSpanElement(pNode, slideLayoutSpNode, slideMasterSpNode, type, warpObj);
    } else if (rNode.constructor === Array) {
      // with multi r
      for (var j = 0; j < rNode.length; j++) {
        text += genSpanElement(rNode[j], slideLayoutSpNode, slideMasterSpNode, type, warpObj);
      }
    } else {
      // with one r
      text += genSpanElement(rNode, slideLayoutSpNode, slideMasterSpNode, type, warpObj);
    }
    text += '</div>';
  }

  return text;
}

function genBuChar(node) {
  var pPrNode = node['a:pPr'];

  debug(JSON.stringify(pPrNode));

  var lvl = parseInt(getTextByPathList(pPrNode, ['@_lvl']));
  if (isNaN(lvl)) {
    lvl = 0;
  }

  var buChar = getTextByPathList(pPrNode, ['a:buChar', '@_char']);
  if (buChar !== undefined) {
    var buFont = getTextByPathList(pPrNode, ['a:buFont']);
    if (buFont !== undefined) {
      var marginLeft = (parseInt(getTextByPathList(pPrNode, ['@_marL'])) * 96) / 914400;
      var marginRight = parseInt(buFont['@_pitchFamily']);
      if (isNaN(marginLeft)) {
        marginLeft = (328600 * 96) / 914400;
      }
      if (isNaN(marginRight)) {
        marginRight = 0;
      }
      var typeface = buFont['@_typeface'];

      return (
        "<span style='font-family: " +
        typeface +
        '; margin-left: ' +
        marginLeft * lvl +
        'px' +
        '; margin-right: ' +
        marginRight +
        'px' +
        '; font-size: 20pt' +
        "'>" +
        buChar +
        '</span>'
      );
    } else {
      marginLeft = ((328600 * 96) / 914400) * lvl;
      return "<span style='margin-left: " + marginLeft + "px;'>" + buChar + '</span>';
    }
  } else {
    //buChar = '•';
    return (
      "<span style='margin-left: " +
      ((328600 * 96) / 914400) * lvl +
      'px' +
      '; margin-right: ' +
      0 +
      "px;'></span>"
    );
  }

  return '';
}

function genSpanElement(node, slideLayoutSpNode, slideMasterSpNode, type, warpObj) {
  var slideMasterTextStyles = warpObj['slideMasterTextStyles'];

  var text = node['a:t'];
  if (typeof text !== 'string') {
    text = getTextByPathList(node, ['a:fld', 'a:t']);
    if (typeof text !== 'string') {
      text = '&nbsp;';
      //debug("XXX: " + JSON.stringify(node));
    }
  }

  const color = getFontColor(node, type, slideMasterTextStyles);

  const rgb = new colz.Color(color);

  const contrastRatio = getContrastRatio(rgb, COLOR_WHITE);

  const bgColor = contrastRatio < MIN_CONTRAST_RATIO ? '#000' : '#fff';

  var styleText =
    'color:' +
    color +
    ';font-size:' +
    getFontSize(node, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles) +
    ';font-family:' +
    getFontType(node, type, slideMasterTextStyles) +
    ';font-weight:' +
    getFontBold(node, type, slideMasterTextStyles) +
    ';font-style:' +
    getFontItalic(node, type, slideMasterTextStyles) +
    ';text-decoration:' +
    getFontDecoration(node, type, slideMasterTextStyles) +
    ';vertical-align:' +
    getTextVerticalAlign(node, type, slideMasterTextStyles) +
    '; background-color:' +
    bgColor +
    ';';

  var cssName = '';

  if (styleText in styleTable) {
    cssName = styleTable[styleText]['name'];
  } else {
    cssName = '_css_' + (Object.keys(styleTable).length + 1);
    styleTable[styleText] = {
      name: cssName,
      text: styleText,
    };
  }

  var linkID = getTextByPathList(node, ['a:rPr', 'a:hlinkClick', '@_r:id']);
  if (linkID !== undefined) {
    var linkURL = warpObj['slideResObj'][linkID]['target'];
    return (
      "<span class='text-block " +
      cssName +
      "'><a href='" +
      linkURL +
      "' target='_blank'>" +
      text.replace(/\s/i, '&nbsp;') +
      '</a></span>'
    );
  } else {
    return "<span class='text-block " + cssName + "'>" + text.replace(/\s/i, '&nbsp;') + '</span>';
  }
}

function genGlobalCSS() {
  var cssText = '';
  for (var key in styleTable) {
    cssText += 'section .' + styleTable[key]['name'] + '{' + styleTable[key]['text'] + '}\n';
  }
  return cssText;
}

function genTable(node, warpObj) {
  var order = node['@_order'];
  var tableNode = getTextByPathList(node, ['a:graphic', 'a:graphicData', 'a:tbl']);
  var xfrmNode = getTextByPathList(node, ['p:xfrm']);
  var tableHtml =
    "<table style='" +
    getPosition(xfrmNode, undefined, undefined) +
    getSize(xfrmNode, undefined, undefined) +
    ' z-index: ' +
    order +
    ";'>";

  var trNodes = tableNode['a:tr'];
  if (trNodes.constructor === Array) {
    for (var i = 0; i < trNodes.length; i++) {
      tableHtml += '<tr>';
      var tcNodes = trNodes[i]['a:tc'];

      if (tcNodes.constructor === Array) {
        for (var j = 0; j < tcNodes.length; j++) {
          var text = genTextBody(tcNodes[j]['a:txBody'], undefined, undefined, undefined, warpObj);
          var rowSpan = getTextByPathList(tcNodes[j], ['@_rowSpan']);
          var colSpan = getTextByPathList(tcNodes[j], ['@_gridSpan']);
          var vMerge = getTextByPathList(tcNodes[j], ['@_vMerge']);
          var hMerge = getTextByPathList(tcNodes[j], ['@_hMerge']);
          if (rowSpan !== undefined) {
            tableHtml += "<td rowspan='" + parseInt(rowSpan) + "'>" + text + '</td>';
          } else if (colSpan !== undefined) {
            tableHtml += "<td colspan='" + parseInt(colSpan) + "'>" + text + '</td>';
          } else if (vMerge === undefined && hMerge === undefined) {
            tableHtml += '<td>' + text + '</td>';
          }
        }
      } else {
        var text = genTextBody(tcNodes['a:txBody']);
        tableHtml += '<td>' + text + '</td>';
      }
      tableHtml += '</tr>';
    }
  } else {
    tableHtml += '<tr>';
    var tcNodes = trNodes['a:tc'];
    if (tcNodes.constructor === Array) {
      for (var j = 0; j < tcNodes.length; j++) {
        var text = genTextBody(tcNodes[j]['a:txBody']);
        tableHtml += '<td>' + text + '</td>';
      }
    } else {
      var text = genTextBody(tcNodes['a:txBody']);
      tableHtml += '<td>' + text + '</td>';
    }
    tableHtml += '</tr>';
  }

  return tableHtml;
}

async function genChart(node, warpObj) {
  var order = node['@_order'];
  var xfrmNode = getTextByPathList(node, ['p:xfrm']);
  var result =
    "<div id='chart" +
    chartID +
    "' class='block content' style='" +
    getPosition(xfrmNode, undefined, undefined) +
    getSize(xfrmNode, undefined, undefined) +
    ' z-index: ' +
    order +
    ";'></div>";

  var rid = node['a:graphic']['a:graphicData']['c:chart']['@_r:id'];
  var refName = warpObj['slideResObj'][rid]['target'];
  var content = await readXmlFile(warpObj['zip'], refName);
  var plotArea = getTextByPathList(content, ['c:chartSpace', 'c:chart', 'c:plotArea']);

  var chartData = null;
  for (var key in plotArea) {
    switch (key) {
      case 'c:lineChart':
        chartData = {
          type: 'createChart',
          data: {
            chartID: 'chart' + chartID,
            chartType: 'lineChart',
            chartData: extractChartData(plotArea[key]['c:ser']),
          },
        };
        break;
      case 'c:barChart':
        chartData = {
          type: 'createChart',
          data: {
            chartID: 'chart' + chartID,
            chartType: 'barChart',
            chartData: extractChartData(plotArea[key]['c:ser']),
          },
        };
        break;
      case 'c:pieChart':
        chartData = {
          type: 'createChart',
          data: {
            chartID: 'chart' + chartID,
            chartType: 'pieChart',
            chartData: extractChartData(plotArea[key]['c:ser']),
          },
        };
        break;
      case 'c:pie3DChart':
        chartData = {
          type: 'createChart',
          data: {
            chartID: 'chart' + chartID,
            chartType: 'pie3DChart',
            chartData: extractChartData(plotArea[key]['c:ser']),
          },
        };
        break;
      case 'c:areaChart':
        chartData = {
          type: 'createChart',
          data: {
            chartID: 'chart' + chartID,
            chartType: 'areaChart',
            chartData: extractChartData(plotArea[key]['c:ser']),
          },
        };
        break;
      case 'c:scatterChart':
        chartData = {
          type: 'createChart',
          data: {
            chartID: 'chart' + chartID,
            chartType: 'scatterChart',
            chartData: extractChartData(plotArea[key]['c:ser']),
          },
        };
        break;
      case 'c:catAx':
        break;
      case 'c:valAx':
        break;
      default:
    }
  }

  if (chartData !== null) {
    MsgQueue.push(chartData);
  }

  chartID++;
  return result;
}

function genDiagram(node, warpObj) {
  var order = node['@_order'];
  var xfrmNode = getTextByPathList(node, ['p:xfrm']);
  return (
    "<div class='block content' style='border: 1px dotted;" +
    getPosition(xfrmNode, undefined, undefined) +
    getSize(xfrmNode, undefined, undefined) +
    "'>TODO: diagram</div>"
  );
}

function getPosition(slideSpNode, slideLayoutSpNode, slideMasterSpNode) {
  //debug(JSON.stringify(slideLayoutSpNode));
  //debug(JSON.stringify(slideMasterSpNode));

  var off = undefined;
  var x = -1,
    y = -1;

  if (slideSpNode !== undefined) {
    off = slideSpNode['a:off'];
  } else if (slideLayoutSpNode !== undefined) {
    off = slideLayoutSpNode['a:off'];
  } else if (slideMasterSpNode !== undefined) {
    off = slideMasterSpNode['a:off'];
  }

  if (off === undefined) {
    return '';
  } else {
    // TODO improve calculation
    x = (parseInt(off['@_x']) * 96) / 914400;
    y = (parseInt(off['@_y']) * 96) / 914400;
    return isNaN(x) || isNaN(y) ? '' : 'top:' + y + 'px; left:' + x + 'px;';
  }
}

function getSize(slideSpNode, slideLayoutSpNode, slideMasterSpNode) {
  //debug(JSON.stringify(slideLayoutSpNode));
  //debug(JSON.stringify(slideMasterSpNode));

  var ext = undefined;
  var w = -1,
    h = -1;

  if (slideSpNode !== undefined) {
    ext = slideSpNode['a:ext'];
  } else if (slideLayoutSpNode !== undefined) {
    ext = slideLayoutSpNode['a:ext'];
  } else if (slideMasterSpNode !== undefined) {
    ext = slideMasterSpNode['a:ext'];
  }

  if (ext === undefined) {
    return '';
  } else {
    w = (parseInt(ext['@_cx']) * 96) / 914400;
    h = (parseInt(ext['@_cy']) * 96) / 914400;
    return isNaN(w) || isNaN(h) ? '' : 'width:' + w + 'px; height:' + h + 'px;';
  }
}

function getHorizontalAlign(
  node,
  slideLayoutSpNode,
  slideMasterSpNode,
  type,
  slideMasterTextStyles
) {
  //debug(node);
  var algn = getTextByPathList(node, ['a:pPr', '@_algn']);
  if (algn === undefined) {
    algn = getTextByPathList(slideLayoutSpNode, ['p:txBody', 'a:p', 'a:pPr', '@_algn']);
    if (algn === undefined) {
      algn = getTextByPathList(slideMasterSpNode, ['p:txBody', 'a:p', 'a:pPr', '@_algn']);
      if (algn === undefined) {
        switch (type) {
          case 'title':
          case 'subTitle':
          case 'ctrTitle':
            algn = getTextByPathList(slideMasterTextStyles, [
              'p:titleStyle',
              'a:lvl1pPr',
              '@_alng',
            ]);
            break;
          default:
            algn = getTextByPathList(slideMasterTextStyles, [
              'p:otherStyle',
              'a:lvl1pPr',
              '@_alng',
            ]);
        }
      }
    }
  }
  // TODO:
  if (algn === undefined) {
    if (type == 'title' || type == 'subTitle' || type == 'ctrTitle') {
      return 'h-mid';
    } else if (type == 'sldNum') {
      return 'h-right';
    }
  }
  return algn === 'ctr' ? 'h-mid' : algn === 'r' ? 'h-right' : 'h-left';
}

function getVerticalAlign(node, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles) {
  // 上中下對齊: X, <a:bodyPr anchor="ctr">, <a:bodyPr anchor="b">
  var anchor = getTextByPathList(node, ['p:txBody', 'a:bodyPr', '@_anchor']);
  if (anchor === undefined) {
    anchor = getTextByPathList(slideLayoutSpNode, ['p:txBody', 'a:bodyPr', '@_anchor']);
    if (anchor === undefined) {
      anchor = getTextByPathList(slideMasterSpNode, ['p:txBody', 'a:bodyPr', '@_anchor']);
    }
  }

  return anchor === 'ctr' ? 'v-mid' : anchor === 'b' ? 'v-down' : 'v-up';
}

function getFontType(node, type, slideMasterTextStyles) {
  var typeface = getTextByPathList(node, ['a:rPr', 'a:latin', '@_typeface']);

  if (typeface === undefined) {
    var fontSchemeNode = getTextByPathList(themeContent, [
      'a:theme',
      'a:themeElements',
      'a:fontScheme',
    ]);
    if (type == 'title' || type == 'subTitle' || type == 'ctrTitle') {
      typeface = getTextByPathList(fontSchemeNode, ['a:majorFont', 'a:latin', '@_typeface']);
    } else if (type == 'body') {
      typeface = getTextByPathList(fontSchemeNode, ['a:minorFont', 'a:latin', '@_typeface']);
    } else {
      typeface = getTextByPathList(fontSchemeNode, ['a:minorFont', 'a:latin', '@_typeface']);
    }
  }

  return typeface === undefined ? 'inherit' : `${typeface}, sans-serif`;
}

function getFontColor(node, type, slideMasterTextStyles) {
  var color = getTextByPathStr(node, 'a:rPr a:solidFill a:srgbClr @_val');
  return color === undefined ? '#000' : '#' + color;
}

function getFontSize(node, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles) {
  var fontSize = undefined;
  if (node['a:rPr'] !== undefined) {
    fontSize = parseInt(node['a:rPr']['@_sz']) / 100;
  }

  if (isNaN(fontSize) || fontSize === undefined) {
    var sz = getTextByPathList(slideLayoutSpNode, [
      'p:txBody',
      'a:lstStyle',
      'a:lvl1pPr',
      'a:defRPr',
      '@_sz',
    ]);
    fontSize = parseInt(sz) / 100;
  }

  if (isNaN(fontSize) || fontSize === undefined) {
    if (type == 'title' || type == 'subTitle' || type == 'ctrTitle') {
      var sz = getTextByPathList(slideMasterTextStyles, [
        'p:titleStyle',
        'a:lvl1pPr',
        'a:defRPr',
        '@_sz',
      ]);
    } else if (type == 'body') {
      var sz = getTextByPathList(slideMasterTextStyles, [
        'p:bodyStyle',
        'a:lvl1pPr',
        'a:defRPr',
        '@_sz',
      ]);
    } else if (type == 'dt' || type == 'sldNum') {
      var sz = '1200';
    } else if (type === undefined) {
      var sz = getTextByPathList(slideMasterTextStyles, [
        'p:otherStyle',
        'a:lvl1pPr',
        'a:defRPr',
        '@_sz',
      ]);
    }
    fontSize = parseInt(sz) / 100;
  }

  var baseline = getTextByPathList(node, ['a:rPr', '@_baseline']);
  if (baseline !== undefined && !isNaN(fontSize)) {
    fontSize -= 10;
  }

  // enforce minimum font size
  fontSize = Math.max(fontSize, MIN_FONT_SIZE);

  return isNaN(fontSize) ? 'inherit' : fontSize + 'pt';
}

function getFontBold(node, type, slideMasterTextStyles) {
  return node['a:rPr'] !== undefined && node['a:rPr']['@_b'] === '1' ? 'bold' : 'initial';
}

function getFontItalic(node, type, slideMasterTextStyles) {
  return node['a:rPr'] !== undefined && node['a:rPr']['@_i'] === '1' ? 'italic' : 'normal';
}

function getFontDecoration(node, type, slideMasterTextStyles) {
  return node['a:rPr'] !== undefined && node['a:rPr']['@_u'] === 'sng' ? 'underline' : 'initial';
}

function getTextVerticalAlign(node, type, slideMasterTextStyles) {
  var baseline = getTextByPathList(node, ['a:rPr', '@_baseline']);
  return baseline === undefined ? 'baseline' : parseInt(baseline) / 1000 + '%';
}

function getBorder(node, isSvgMode) {
  //debug(JSON.stringify(node));

  var cssText = 'border: ';

  // 1. presentationML
  var lineNode = node['p:spPr']['a:ln'];

  // Border width: 1pt = 12700, default = 0.75pt
  var borderWidth = parseInt(getTextByPathList(lineNode, ['@_w'])) / 12700;
  if (isNaN(borderWidth) || borderWidth < 1) {
    cssText += '1pt ';
  } else {
    cssText += borderWidth + 'pt ';
  }

  // Border color
  var borderColor = getTextByPathList(lineNode, ['a:solidFill', 'a:srgbClr', '@_val']);
  if (borderColor === undefined) {
    var schemeClrNode = getTextByPathList(lineNode, ['a:solidFill', 'a:schemeClr']);
    var schemeClr = 'a:' + getTextByPathList(schemeClrNode, ['@_val']);
    var borderColor = getSchemeColorFromTheme(schemeClr);
  }

  // 2. drawingML namespace
  if (borderColor === undefined) {
    var schemeClrNode = getTextByPathList(node, ['p:style', 'a:lnRef', 'a:schemeClr']);
    var schemeClr = 'a:' + getTextByPathList(schemeClrNode, ['@_val']);
    var borderColor = getSchemeColorFromTheme(schemeClr);

    if (borderColor !== undefined) {
      var shade = getTextByPathList(schemeClrNode, ['a:shade', '@_val']);
      if (shade !== undefined) {
        shade = parseInt(shade) / 100000;
        var color = new colz.Color('#' + borderColor);
        color.setLum(color.hsl.l * shade);
        borderColor = color.hex.replace('#', '');
      }
    }
  }

  if (borderColor === undefined) {
    if (isSvgMode) {
      borderColor = 'none';
    } else {
      borderColor = '#000';
    }
  } else {
    borderColor = '#' + borderColor;
  }
  cssText += ' ' + borderColor + ' ';

  // Border type
  var borderType = getTextByPathList(lineNode, ['a:prstDash', '@_val']);
  var strokeDasharray = '0';
  switch (borderType) {
    case 'solid':
      cssText += 'solid';
      strokeDasharray = '0';
      break;
    case 'dash':
      cssText += 'dashed';
      strokeDasharray = '5';
      break;
    case 'dashDot':
      cssText += 'dashed';
      strokeDasharray = '5, 5, 1, 5';
      break;
    case 'dot':
      cssText += 'dotted';
      strokeDasharray = '1, 5';
      break;
    case 'lgDash':
      cssText += 'dashed';
      strokeDasharray = '10, 5';
      break;
    case 'lgDashDotDot':
      cssText += 'dashed';
      strokeDasharray = '10, 5, 1, 5, 1, 5';
      break;
    case 'sysDash':
      cssText += 'dashed';
      strokeDasharray = '5, 2';
      break;
    case 'sysDashDot':
      cssText += 'dashed';
      strokeDasharray = '5, 2, 1, 5';
      break;
    case 'sysDashDotDot':
      cssText += 'dashed';
      strokeDasharray = '5, 2, 1, 5, 1, 5';
      break;
    case 'sysDot':
      cssText += 'dotted';
      strokeDasharray = '2, 5';
      break;
    case undefined:
    //console.log(borderType);
    default:
    //console.warn(borderType);
    //cssText += "#000 solid";
  }

  if (isSvgMode) {
    return {
      color: borderColor,
      width: borderWidth,
      type: borderType,
      strokeDasharray: strokeDasharray,
    };
  } else {
    return cssText + ';';
  }
}

function getSlideBackgroundFill(slideContent, slideLayoutContent, slideMasterContent) {
  var bgColor = getSolidFill(
    getTextByPathList(slideContent, ['p:sld', 'p:cSld', 'p:bg', 'p:bgPr', 'a:solidFill'])
  );
  if (bgColor === undefined) {
    bgColor = getSolidFill(
      getTextByPathList(slideLayoutContent, [
        'p:sldLayout',
        'p:cSld',
        'p:bg',
        'p:bgPr',
        'a:solidFill',
      ])
    );
    if (bgColor === undefined) {
      bgColor = getSolidFill(
        getTextByPathList(slideMasterContent, [
          'p:sldMaster',
          'p:cSld',
          'p:bg',
          'p:bgPr',
          'a:solidFill',
        ])
      );
      if (bgColor === undefined) {
        bgColor = 'FFF';
      }
    }
  }
  return bgColor;
}

function getShapeFill(node, isSvgMode) {
  // 1. presentationML
  // p:spPr [a:noFill, solidFill, gradFill, blipFill, pattFill, grpFill]
  // From slide
  if (getTextByPathList(node, ['p:spPr', 'a:noFill']) !== undefined) {
    return isSvgMode ? 'none' : 'background-color: initial;';
  }

  var fillColor = undefined;
  if (fillColor === undefined) {
    fillColor = getTextByPathList(node, ['p:spPr', 'a:solidFill', 'a:srgbClr', '@_val']);
  }

  // From theme
  if (fillColor === undefined) {
    var schemeClr =
      'a:' + getTextByPathList(node, ['p:spPr', 'a:solidFill', 'a:schemeClr', '@_val']);
    fillColor = getSchemeColorFromTheme(schemeClr);
  }

  // 2. drawingML namespace
  if (fillColor === undefined) {
    var schemeClr =
      'a:' + getTextByPathList(node, ['p:style', 'a:fillRef', 'a:schemeClr', '@_val']);
    fillColor = getSchemeColorFromTheme(schemeClr);
  }

  if (fillColor !== undefined) {
    fillColor = '#' + fillColor;

    // Apply shade or tint
    // TODO: 較淺, 較深 80%
    var lumMod =
      parseInt(
        getTextByPathList(node, ['p:spPr', 'a:solidFill', 'a:schemeClr', 'a:lumMod', '@_val'])
      ) / 100000;
    var lumOff =
      parseInt(
        getTextByPathList(node, ['p:spPr', 'a:solidFill', 'a:schemeClr', 'a:lumOff', '@_val'])
      ) / 100000;
    if (isNaN(lumMod)) {
      lumMod = 1.0;
    }
    if (isNaN(lumOff)) {
      lumOff = 0;
    }
    //console.log([lumMod, lumOff]);
    fillColor = applyLumModify(fillColor, lumMod, lumOff);

    if (isSvgMode) {
      return fillColor;
    } else {
      return 'background-color: ' + fillColor + ';';
    }
  } else {
    if (isSvgMode) {
      return 'none';
    } else {
      return 'background-color: ' + fillColor + ';';
    }
  }
}

function getSolidFill(solidFill) {
  if (solidFill === undefined) {
    return undefined;
  }

  var color = 'FFF';

  if (solidFill['a:srgbClr'] !== undefined) {
    color = getTextByPathList(solidFill['a:srgbClr'], ['@_val']);
  } else if (solidFill['a:schemeClr'] !== undefined) {
    var schemeClr = 'a:' + getTextByPathList(solidFill['a:schemeClr'], ['@_val']);
    color = getSchemeColorFromTheme(schemeClr);
  }

  return color;
}

function getSchemeColorFromTheme(schemeClr) {
  // TODO: <p:clrMap ...> in slide master
  // e.g. tx2="dk2" bg2="lt2" tx1="dk1" bg1="lt1"
  switch (schemeClr) {
    case 'a:tx1':
      schemeClr = 'a:dk1';
      break;
    case 'a:tx2':
      schemeClr = 'a:dk2';
      break;
    case 'a:bg1':
      schemeClr = 'a:lt1';
      break;
    case 'a:bg2':
      schemeClr = 'a:lt2';
      break;
  }
  var refNode = getTextByPathList(themeContent, [
    'a:theme',
    'a:themeElements',
    'a:clrScheme',
    schemeClr,
  ]);
  var color = getTextByPathList(refNode, ['a:srgbClr', '@_val']);
  if (color === undefined) {
    color = getTextByPathList(refNode, ['a:sysClr', '@_lastClr']);
  }
  return color;
}

function extractChartData(serNode) {
  var dataMat = new Array();

  if (serNode === undefined) {
    return dataMat;
  }

  if (serNode['c:xVal'] !== undefined) {
    var dataRow = new Array();
    eachElement(serNode['c:xVal']['c:numRef']['c:numCache']['c:pt'], function (innerNode, index) {
      dataRow.push(parseFloat(innerNode['c:v']));
      return '';
    });
    dataMat.push(dataRow);
    dataRow = new Array();
    eachElement(serNode['c:yVal']['c:numRef']['c:numCache']['c:pt'], function (innerNode, index) {
      dataRow.push(parseFloat(innerNode['c:v']));
      return '';
    });
    dataMat.push(dataRow);
  } else {
    eachElement(serNode, function (innerNode, index) {
      var dataRow = new Array();
      var colName =
        getTextByPathList(innerNode, ['c:tx', 'c:strRef', 'c:strCache', 'c:pt', 'c:v']) || index;

      // Category (string or number)
      var rowNames = {};
      if (getTextByPathList(innerNode, ['c:cat', 'c:strRef', 'c:strCache', 'c:pt']) !== undefined) {
        eachElement(
          innerNode['c:cat']['c:strRef']['c:strCache']['c:pt'],
          function (innerNode, index) {
            rowNames[innerNode['@_idx']] = innerNode['c:v'];
            return '';
          }
        );
      } else if (
        getTextByPathList(innerNode, ['c:cat', 'c:numRef', 'c:numCache', 'c:pt']) !== undefined
      ) {
        eachElement(
          innerNode['c:cat']['c:numRef']['c:numCache']['c:pt'],
          function (innerNode, index) {
            rowNames[innerNode['@_idx']] = innerNode['c:v'];
            return '';
          }
        );
      }

      // Value
      if (getTextByPathList(innerNode, ['c:val', 'c:numRef', 'c:numCache', 'c:pt']) !== undefined) {
        eachElement(
          innerNode['c:val']['c:numRef']['c:numCache']['c:pt'],
          function (innerNode, index) {
            dataRow.push({ x: innerNode['@_idx'], y: parseFloat(innerNode['c:v']) });
            return '';
          }
        );
      }

      dataMat.push({ key: colName, values: dataRow, xlabels: rowNames });
      return '';
    });
  }

  return dataMat;
}

// ===== Node functions =====
/**
 * getTextByPathStr
 * @param {Object} node
 * @param {string} pathStr
 */
function getTextByPathStr(node, pathStr) {
  return getTextByPathList(node, pathStr.trim().split(/\s+/));
}

/**
 * getTextByPathList
 * @param {Object} node
 * @param {string Array} path
 */
function getTextByPathList(node, path) {
  if (path.constructor !== Array) {
    throw Error('Error of path type! path is not array.');
  }

  if (node === undefined) {
    return undefined;
  }

  var l = path.length;
  for (var i = 0; i < l; i++) {
    node = node[path[i]];
    if (node === undefined) {
      return undefined;
    }
  }

  return node;
}

/**
 * eachElement
 * @param {Object} node
 * @param {function} doFunction
 */
function eachElement(node, doFunction) {
  if (node === undefined) {
    return;
  }
  var result = '';
  if (node.constructor === Array) {
    var l = node.length;
    for (var i = 0; i < l; i++) {
      result += doFunction(node[i], i);
    }
  } else {
    result += doFunction(node, 0);
  }
  return result;
}

// ===== Color functions =====
/**
 * applyShade
 * @param {string} rgbStr
 * @param {number} shadeValue
 */
function applyShade(rgbStr, shadeValue) {
  var color = new colz.Color(rgbStr);
  color.setLum(color.hsl.l * shadeValue);
  return color.rgb.toString();
}

/**
 * applyTint
 * @param {string} rgbStr
 * @param {number} tintValue
 */
function applyTint(rgbStr, tintValue) {
  var color = new colz.Color(rgbStr);
  color.setLum(color.hsl.l * tintValue + (1 - tintValue));
  return color.rgb.toString();
}

/**
 * applyLumModify
 * @param {string} rgbStr
 * @param {number} factor
 * @param {number} offset
 */
function applyLumModify(rgbStr, factor, offset) {
  var color = new colz.Color(rgbStr);
  //color.setLum(color.hsl.l * factor);
  color.setLum(color.hsl.l * (1 + offset));
  return color.rgb.toString();
}

// ===== Debug functions =====
/**
 * debug
 * @param {Object} data
 */
function debug(data) {
  self.postMessage({ type: 'DEBUG', data: data });
}

function base64ArrayBuffer(arrayBuffer) {
  var base64 = '';
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var bytes = new Uint8Array(arrayBuffer);
  var byteLength = bytes.byteLength;
  var byteRemainder = byteLength % 3;
  var mainLength = byteLength - byteRemainder;

  var a, b, c, d;
  var chunk;

  for (var i = 0; i < mainLength; i = i + 3) {
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    a = (chunk & 16515072) >> 18;
    b = (chunk & 258048) >> 12;
    c = (chunk & 4032) >> 6;
    d = chunk & 63;
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
  }

  if (byteRemainder == 1) {
    chunk = bytes[mainLength];
    a = (chunk & 252) >> 2;
    b = (chunk & 3) << 4;
    base64 += encodings[a] + encodings[b] + '==';
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
    a = (chunk & 64512) >> 10;
    b = (chunk & 1008) >> 4;
    c = (chunk & 15) << 2;
    base64 += encodings[a] + encodings[b] + encodings[c] + '=';
  }

  return base64;
}

function extractFileExtension(filename) {
  return filename.substr((~-filename.lastIndexOf('.') >>> 0) + 2);
}

/**
 * WCAG AA suggest a 4.5:1. We can just pick the larger contrast with black/white,
 * but that felt too aggressive in my limited testing. TODO: test on a larger sample set.
 */
const MIN_CONTRAST_RATIO = 1.75;

const COLOR_WHITE = new colz.Color(255, 255, 255);

/**
 * Convert an RGB color (0-255) to the value used for determining luminosity
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function adjustedRGB(rgb) {
  let c = rgb / 255;
  c = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return c;
}

function getRelativeLuminance(clr) {
  return 0.2126 * adjustedRGB(clr.r) + 0.7152 * adjustedRGB(clr.g) + 0.0722 * adjustedRGB(clr.b);
}

function getContrastRatio(color1, color2) {
  const lums = [color1, color2].map(getRelativeLuminance);
  return (Math.max(...lums) + 0.05) / (Math.min(...lums) + 0.05);
}

export default {};
