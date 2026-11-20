package vn.vietduc.carehubbackend.config;

import org.hibernate.boot.model.FunctionContributions;
import org.hibernate.boot.model.FunctionContributor;
import org.hibernate.type.StandardBasicTypes;
import vn.vietduc.carehubbackend.common.SearchText;

/** Registers the SQL function's string return type for JPQL LIKE predicates. */
public class SearchFunctionContributor implements FunctionContributor {
    @Override
    public void contributeFunctions(FunctionContributions contributions) {
        contributions.getFunctionRegistry().namedDescriptorBuilder(SearchText.SQL_FUNCTION)
                .setExactArgumentCount(1)
                .setInvariantType(contributions.getTypeConfiguration().getBasicTypeRegistry().resolve(StandardBasicTypes.STRING))
                .register();
    }
}
