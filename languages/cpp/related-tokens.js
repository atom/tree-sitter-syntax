const {closest, findAll, getText, getNamedChild, findFirstNamed, nodeIsBig} = require('../../lib/node-helpers');

module.exports =
function(node, buffer, rootNode) {
  switch (node.type) {
    case 'identifier':
      return getVariableUsages(node, buffer, rootNode)
  }
}

function getVariableUsages(node, buffer, rootNode) {
  const variableName = getText(node, buffer)
  let scope = node

  while (true) {
    let nextScope = closest(scope, 'compound_statement')
    if (!nextScope) {
      const parameterList = closest(scope, 'parameter_list')
      if (parameterList) {
        const functionNode = closest(parameterList, ['function_definition', 'lambda_expression']);
        if (functionNode) nextScope = getNamedChild(functionNode, 'compound_statement')
      } else if (scope.parent) {
        nextScope = rootNode
      }
    }
    scope = nextScope
    if (!scope || nodeIsBig(scope)) break

    let variableDeclarationNode

    const {parent} = scope
    if (parent) {
      switch (parent.type) {
        case 'function_definition':
        case 'lambda_expression':
          const parameterList = findFirstNamed(parent, 'parameter_list')
          if (parameterList) {
            parameterList.namedChildren.forEach(parameterDeclaration => {
              const parameterNameNode = findFirstNamed(parameterDeclaration, 'identifier')
              if (parameterNameNode && getText(parameterNameNode, buffer) === variableName) {
                variableDeclarationNode = parameterNameNode
              }
            })
          }
          break

        case 'for_range_loop': {
          const rangeDeclaration = findFirstNamed(parent, 'for_range_declaration')
          rangeDeclaration.namedChildren.forEach(declarator => {
            const variableNameNode = findFirstNamed(declarator, 'identifier', true)
            if (variableNameNode && getText(variableNameNode, buffer) === variableName) {
              variableDeclarationNode = variableNameNode
              return
            }
          })
          break
        }
      }
    }

    if (!variableDeclarationNode) {
      const declarationNodes = findAll(scope, 'declaration', {stopAt: 'compound_statement'})

      declarationLoop:
      for (const declarationNode of declarationNodes) {
        const declarators = declarationNode.namedChildren
        for (let i = 1, n = declarators.length; i < n; i++) {
          const variableNameNode = findFirstNamed(declarators[i], 'identifier', true)
          if (variableNameNode && getText(variableNameNode, buffer) === variableName) {
            variableDeclarationNode = variableNameNode
            break declarationLoop
          }
        }
      }
    }

    if (variableDeclarationNode) {
      const results = [
        {node: variableDeclarationNode, highlightClass: 'variable-definition'}
      ]

      const identifiers = findAll(scope, 'identifier');
      for (let i = 0, n = identifiers.length; i < n; i++) {
        const identifier = identifiers[i];
        if (identifier !== variableDeclarationNode) {
          if (getText(identifier, buffer) === variableName) {
            results.push({node: identifier, highlightClass: 'variable-usage'})
          }
        }
      }

      return results
    }
  }

  return null
}
